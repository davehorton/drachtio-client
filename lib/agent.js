var Emitter = require('events').EventEmitter ;
var net = require('net') ;
var merge = require('merge') ;
var Request = require('./request') ;
var Response = require('./response') ;
var uuid = require('node-uuid') ;
var SipMessage = require('drachtio-sip').SipMessage ;
var debug = require('debug')('drachtio:client');
var logger = require('./logger') ;
var methods = require('./methods') ;
var DigestClient = require('./digest-client') ;
var noop = require('node-noop').noop;
var util = require('util') ;

module.exports = exports = Agent ;

var CR = '\r' ;
var CRLF = '\r\n' ;

var defer = typeof setImmediate === 'function' ? setImmediate : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)); } ;


var send = function( agent, msg ) {
	var msgId = uuid.v1() ;
	var s = msgId + '|' + msg ;
	agent.socket.write( s.length + '#' + s ) ;
	agent.apiLogger( '===>' + CRLF + s.length + '#' + s + CRLF) ;
	return msgId ;
} ;

var resetVerbs = function(agent) {
	for( var verb in agent.verbs ) {
		agent.verbs[verb].sent = false ;
	}
	debug('reset verbs to: ', agent.verbs) ;
} ;

var routeVerbs = function(agent) {
	debug('routing verbs: ', agent.verbs); 
	for( var verb in agent.verbs ) {
		if( agent.verbs[verb].sent ) { continue ;}

		agent.verbs[verb].sent = true ;
		agent.verbs[verb].acknowledged = false ;
		agent.verbs[verb].rid = send(agent, 'route|' + verb) ;
	}
} ;


var parseMessageHeader = function( agent, msg, hashPosition ) {
	var len = parseInt( msg.slice(0, hashPosition) ) ;
	if( isNaN( len ) ) { throw new Error('invalid length for message: ' + msg) ; }

	agent.incomingMsgLength = len ;
	var start = ++hashPosition ;
	var end = start + len ;
	agent.incomingMsg += msg.slice(start, end) ;
	msg = msg.length === (end + 1) ? '' : msg.slice(hashPosition + len) ;
	return msg ; //return remainder to use for next message
} ;

var sendMessage = function( agent, msg, opts ) {
	var m = msg ;

	if( opts && (opts.headers || opts.body ) ) {
		m = new SipMessage( msg ) ;
		for( var hdr in (opts.headers || {}) ) { 
			m.set(hdr, opts.headers[hdr]) ; 
		}
		if( opts.body ) { m.body = opts.body ; }
	}

	var s = 'sip|' ;
	if( opts && opts.stackTxnId ) {
		s += opts.stackTxnId ;
	}
	s += '|' ;
	if( opts && opts.stackDialogId ) {
		s += opts.stackDialogId ;
	}
	s += CRLF + m.toString() ;

	return send( agent, s ) ;	
} ;

var handle = function( agent, msg ) {
	var pos = msg.indexOf(CR) ;
	var leader = -1 === pos ? msg : msg.slice(0,pos) ;
	var token = leader.split('|') ;
	var res ;
	var sr ;
	var rawMsg ;

	switch( token[1] ) {
	case 'sip':
		rawMsg = msg.slice( pos+2 ) ;
		var sipMsg = new SipMessage( rawMsg ) ;
		var source = token[2] ;
		//var numBytes = token[3] ;
		var protocol = token[4] ;
		var address = token[5] ;
		var port = token[6] ;
		var time = token[7] ;
		var transactionId = token[8] ;
		var dialogId = token[9] ;
		var meta = {
			source: source,
			address: address,
			port: port,
			protocol: protocol,
			time: time,
			transactionId: transactionId,
			dialogId: dialogId
		} ;
		if( token.length > 9 ) {

			if( 'network' === source && sipMsg.type === 'request' ) {

				//handle CANCELS by locating the associated INVITE and emitting a 'cancel' event
				var callId = sipMsg.get('call-id') ;
				if( 'CANCEL' === sipMsg.method && callId in agent.pendingNetworkInvites ) {
					agent.pendingNetworkInvites[callId].req.emit('cancel') ;
					delete agent.pendingNetworkInvites[callId] ;
					debug('Agent#handle - emitted cancel event for INVITE with call-id %s, remaining count of invites in progress: %d', 
						callId, Object.keys(agent.pendingNetworkInvites).length ) ;
					return ;
				}


				var req = new Request( sipMsg, meta) ;
				res = new Response() ;
				req.res = res ;
				res.req = req ;
				req.agent = res.agent = agent ;

				if( 'INVITE' === req.method ) {
					agent.pendingNetworkInvites[callId] = {
						req: req,
						res: res
					} ;
					debug('Agent#handle: tracking an incoming invite with call-id %s, currently tracking %d invites in progress', 
						callId, Object.keys(agent.pendingNetworkInvites).length ) ;			
				}

				agent.cb( req, res ) ;
			}
			else if( 'network' === source ) {
				if( transactionId in agent.pendingSipRequests ) {
					sr = agent.pendingSipRequests[transactionId] ;
					res = new Response(agent) ;
					res.msg = sipMsg ;
					res.meta = meta ;
					res.req = sr.req ;

					debug('Agent#handle: got a response with status: %d', res.status) ;

					if( res.status >= 200 ) {
						delete agent.pendingSipRequests[transactionId]  ;
					}

					//prepare a function to be called for prack or ack, if appropriate
					var ack ;
					if( res.status >= 200 && res.req.method === 'INVITE') {
						ack = Response.prototype.sendAck.bind( res, token[9]) ;
					}
					else if( res.status > 100 && res.status < 200 ) {
						var require = res.req.get('Require');
						if( require && -1 !== require.indexOf('100rel')) {
							ack = Response.prototype.sendPrack.bind( res, token[9]) ;
						}
					}
					// If its a challenge and the user supplied username and password, automatically handle it
					debug('res.req: ', JSON.stringify(res.req)) ;
					var cid = res.msg.headers['call-id']; 
					debug('Agent#handle: got a response with callid %s', cid) ;
					debug('agent.pendingSipAuthRequests: ', agent.pendingSipAuthRequests) ;
					if( cid in agent.pendingSipAuthRequests ) {
						debug('received response to authed request with status: %d; we are done - gave it our best shot'. res.status) ;
						delete agent.pendingSipAuthRequests[cid] ;

					}
					else if( (401 === res.status || 407 === res.status) && (!!res.req.auth) ) {
						debug('got a response with a challenge that we can respond to') ;
						agent.pendingSipAuthRequests[cid] = true ;
						var client = new DigestClient( res ) ;
						client.authenticate( function(err, req) {
							// move all listeners from the old request to the new one we just generated
							res.req.listeners('response').forEach( function(l) {
								req.on('response', l) ;
							}) ;
							debug('resent request with authentication credentials') ;
							res.req.emit('authenticate', req) ;
						}) ;
						return ;
					}
					sr.req.emit('response', res, ack ) ;										
				}
			}					
		}

		break ;

	case 'response':
		var rId = token[2] ;
		if( rId in agent.pendingRequests ) {
			if( -1 !== pos ) { rawMsg = msg.slice(pos+2) ; }
			var meta2 = {
				source: token[4],
				address: token[7],
				port: token[8],
				protocol: token[6],
				time: token[9],
				transactionId: token[10],
				dialogId: token[11]
			} ;
			var fn = agent.pendingRequests[rId].bind( this, token.slice(3), rawMsg, meta2 ) ;
			if( 'continue' !== token[12] ) { delete agent.pendingRequests[rId] ; }
			fn() ;
		}
		break ;

	case 'cdr:attempt':
	case 'cdr:start':
	case 'cdr:stop':
		var cdrEvent = token[1].slice(4)  ;
		var msgSource = token[2] ;
		var msgTime = token[3] ;
		rawMsg = msg.slice( pos+2 ) ;
		var cdrSipMsg = new SipMessage( rawMsg ) ;
		var args = [msgSource, msgTime] ;
		if( cdrEvent !== 'attempt') { args.push( token[4] ) ; }
		args.push( cdrSipMsg ) ;

		if( cdrEvent in agent.cdrHandlers) {
			agent.cdrHandlers[cdrEvent].apply( agent, args ) ;
		}
		break ;

	default:
		throw new Error('unexpected message with type: ' + token[1]) ;		
	}
} ;


var onClose = function(agent) {
	debug('connection to drachtio server lost') ;
	resetVerbs(agent); 
	agent.connected = false ;
	agent.connection_gone("close");
	agent.emit.call( agent, 'close' ) ;
} ;

var onConnect = function(agent) {
	debug('got connect event') ;
	agent.initialize_retry_vars() ;	
	agent.connected = true ;
	agent.ready = false ;

	var msgId = send(agent, 'authenticate|' + agent.secret + '|' + agent.label ) ;
	agent.pendingRequests[msgId] = function(response) {
		agent.authenticated = ('OK' === response[0]) ;
		if( agent.authenticated ) {
			agent.ready = true ;
			agent.set('hostport', response[1]) ;
			debug('sucessfully authenticated, hostport is ', response[1]) ;
			routeVerbs(agent) ;

			//hack: attempt to have our route requests go through before we announce we're connected
			//not sure this is relevant for production, but in test scenarios we fire into tests as
			//soon as connected, and in the case of the cdr tests we got intermittent failures resulting
			//from not having routed cdr:start etc before the calls started arriving
			setTimeout( function() {
				Emitter.prototype.emit.call( agent, 'connect', null, response[1]) ;
			}, 100) ;

		}
		else {
			Emitter.prototype.emit.call( agent, 'connect', 'failed to authenticate to server') ;
		}
	} ;
} ;

var onError = function(agent, err) {
   var message = 'drachtio-client connection to ' + agent.host + ':' + agent.port + ' failed - ' + err;

    if (agent.closing) {
        return;
    }

    if (exports.debug_mode) {
        console.warn(message);
    }

    agent.connected = false;
    agent.ready = false;
    resetVerbs(agent) ;

    agent.emit("error", new Error(message));
    // "error" events get turned into exceptions if they aren't listened for.  If the user handled this error
    // then we should try to reconnect.
    agent.connection_gone("error");	
} ;

var onData = function(agent, msg) {
	agent.apiLogger( '<===' + CRLF + msg + CRLF) ;

	while( msg.length > 0 ) {
		var pos ;
		if( 0 === agent.incomingMsg.length ) {
			//waiting for a new message
			pos = msg.indexOf('#') ;
			if( -1 === pos ) {
				if( msg.match(/^\\d+$/) ) {
					//it can happen that a message is broken between the length digits and '#'
					agent.incomingMsg = msg ;
					agent.incomingMsgLength = -1 ;	//unknown
					console.log('got a message split in the length fragment: ' + msg) ;
					return ;
				}
				else { 
					throw new Error('invalid message from server, did not start with length#: ' + msg) ;	
				}
			}
			msg = parseMessageHeader( agent, msg, pos ); 
		}
		else if( -1 === agent.incomingMsgLength ) {
			//got a length fragment last time
			agent.incomingMsg += msg ;
			pos = msg.indexOf('#') ;
			if( -1 === pos ) {
				throw new Error('invalid message from server, did not start with length#: ' + msg) ; //cant split twice in a length fragment
			}
			msg = parseMessageHeader( agent, msg, pos) ;
		}
		else {
			//got a fragment last time
			var remainderSize = agent.incomingMsgLength - agent.incomingMsg.length ;
			agent.incomingMsg += msg.slice(0, remainderSize) ;
			msg = msg.slice(remainderSize) ;
		}

		//if we've got a full message, process it
		if( agent.incomingMsg.length === agent.incomingMsgLength ) {
			handle( agent, agent.incomingMsg ) ;
			agent.incomingMsg = '' ;
		}
	}
} ;


var normalizeParams  = function(uri, options, callback) {
	
	if (typeof uri === 'undefined' ) {
		var err = new Error('undefined is not a valid request_uri or options object.') ;
		console.error( err.stack ) ;
		throw err ;
	}

	// uac( request_uri, options, callback, ..)
	if (options && typeof options === 'object' ) {
		options.uri = uri ;
	} 
	// uac( request_uri, callback, ..)
	else if (typeof uri === 'string') {
		options = {uri:uri } ;
	}
	// uac( option, callback, ..) 
	else {
		callback = options ;
		options = uri ;
		uri = options.uri; 
	}
	callback = callback || noop ;

	options.method = options.method.toUpperCase() ;

	return { uri: uri, options: options, callback: callback } ;
} ;

var makeRequest = function( agent, params ) {

	debug('makeRequest: params: ', params) ;

	//allow for requests within a dialog, where caller does not need to supply a uri
	if( !params.options.uri && !!params.options.stackDialogId ) {
		params.options.uri = 'sip:placeholder' ;
	} 

	var m = new SipMessage(params.options) ;

	//new outgoing request 
	var msg = 'sip|' ;
	if( params.options.stackTxnId ) {
		msg += params.options.stackTxnId ;
	}
	msg += '|' ;
	if( params.options.stackDialogId ) {
		msg += params.options.stackDialogId ;
	}

	var msgId = send(agent, msg + CRLF + m.toString() ) ;
	agent.pendingRequests[msgId] = function(token, msg) {
		if( token[0] === 'OK') {
			var transactionId = token[7] ;
			var meta = {
				source: token[1],
				address: token[4],
				port: token[5],
				protocol: token[3],
				time: token[6],
				transactionId: transactionId
			} ;

			var req = new Request( new SipMessage( msg ), meta ) ;
			req.agent = agent ;
			debug('handle: params: ', JSON.stringify(params)) ;
			if( !!params.options.auth ) {
				req.auth = params.options.auth ;
				req._originalParams = params ;
			}

			//Note: unfortunately, sofia (the nta layer) does not pass up the 200 OK response to a CANCEL
			//so we are unable to route it up to the application.
			//Therefore, we can't allocate this callback since it would never be called or freed
			if( params.options.method !== 'CANCEL') {
				agent.pendingSipRequests[transactionId] = {
					req: req
				} ;				
			}

			params.callback( null, req ) ;

		}
		else {
			params.callback(token[1] || 'request failed') ;
		}
	} ;
} ;
function Agent( cb ){
	if (!(this instanceof Agent)) { return new Agent(cb); }

	if( typeof cb !== 'function' ) { throw new Error('Agent constructor requires a message callback function') ; }

	Emitter.call(this); 

	this.cb = cb ;
	this.connected = false ;
	this.ready = false ;
	this.authenticated = false ;
	this.incomingMsg = '' ;
	this.verbs = {} ;
	this.label = '' ;
	this.params = {} ;

	//any request message awaiting a response from the drachtio server
	this.pendingRequests = {} ;

	//any sip request generated by us awaiting a final response from the server
	this.pendingSipRequests = {} ;

	//any sip request generated by us that we are resending with Authorization header
	this.pendingSipAuthRequests = {} ;

	//any sip INVITE we've received that we've not yet generated a final response for
	this.pendingNetworkInvites = {} ;

	this.cdrHandlers = {} ;

	this.apiLogger = function(){} ;

	this.__defineGetter__('idle', function() {
		var pendingCount = Object.keys(this.pendingRequests).length ;
		var pendingSipCount = Object.keys(this.pendingSipRequests).length ;
		if( pendingCount > 0 ) {
			console.log('count of pending requests: %d', pendingCount) ;
			console.log(util.inspect(this.pendingRequests)) ;
		}
		if( pendingSipCount > 0 ) {
			console.log('count of pending sip requests: %d', pendingSipCount) ;
			console.log(util.inspect(this.pendingSipRequests)) ;
		}

		return pendingCount + pendingSipCount === 0 ;
	}) ;

}
util.inherits(Agent, Emitter) ;

Agent.prototype.on = function(event, fn) {
	//cdr events are handled through a different mechanism - we register with the server
	if( 0 === event.indexOf('cdr:') ) {
		var name = event.slice(4) ;
		this.cdrHandlers[name] = fn ;
		this.route(event) ;
	}
	else {
		//delegate to EventEmitter
		Emitter.prototype.on.apply( this, arguments )  ;	
	}
} ;

Agent.prototype.connect = function( opts, cb ) {
	if( typeof opts !== 'object' ) { throw new Error('Agent#connect called with invalid args') ; }

	var self = this ;

	//merge( this, opts ) ;
	this.port = opts.port || 9022 ;
	this.host = opts.host || 'localhost' ;
	this.secret = opts.secret ;
	this.label = opts.label || '' ;
	this.methods = opts.methods || [] ;

	this.max_attempts = null;
  if (opts.max_attempts && !isNaN(opts.max_attempts) && opts.max_attempts > 0) {
      this.max_attempts = +opts.max_attempts;
  }
	this.retry_max_delay = null;
  if (opts.retry_max_delay !== undefined && !isNaN(opts.retry_max_delay) && opts.retry_max_delay > 0) {
      this.retry_max_delay = opts.retry_max_delay;
  }
	this.initialize_retry_vars() ;


	if( -1 !== this.methods.indexOf('*') ) {
		this.methods = methods ;
	}
	this.methods.forEach( function(method){
		try {
			self.route(method) ;
		} catch( e ) {
			debug('duplicate route entry: ', method) ;
		}
	}) ;

	this.socket = net.connect({
		port: this.port,
		host: this.host
	}, cb ) ;
	this.socket.setKeepAlive(true);
	this.install_listeners() ;
} ;
Agent.prototype.install_listeners = function() {
	this.socket.setEncoding('utf8') ;
	this.socket.on('error', onError.bind(this.socket, this) ) ;
	this.socket.on('connect', onConnect.bind(this.socket, this) ) ;
	this.socket.on('data', onData.bind( this.socket, this) ) ;
	this.socket.on('close', onClose.bind( this.socket, this ) ) ;
} ;

Agent.prototype.disconnect = function() {
	this.closing = true ;
	if( !this.socket ) { throw new Error('socket is not connected') ; }
	debug('Agent#disconnect from %s', this.host + ':' + this.port) ;
	this.socket.end() ;
} ;
Agent.prototype.route = function( verb ) {
	if( verb in this.verbs ) { throw new Error('duplicate route request for ' + verb) ; }
	this.verbs[verb] = {
		sent: false
	} ;
	if( !this.authenticated ) { return ; }
	
	routeVerbs(this) ;
} ;
Agent.prototype.sendResponse = function( res, opts, callback ) {
	var self = this ;
	var msgId = sendMessage( this, res.msg, merge( {stackTxnId: res.req.stackTxnId}, opts) ) ;
	if( callback ) {
		this.pendingRequests[msgId] = function(token, msg, meta) {
			delete self.pendingRequests[msgId] ;
			if( 'OK' !== token[0] ) { return callback(token[1]) ; }
			res.meta = meta ;
			callback(null, new SipMessage(msg) ) ;
		} ;
	}
	if( res.status >= 200 ) { 
		defer( function() { res.emit('finish'); }); 

		// clear out pending incoming INVITEs when we send a final response
		if( res.req.method === 'INVITE') {
			var callId = res.get('call-id') ;
			delete self.pendingNetworkInvites[callId] ;
			debug('Agent#sendResponse: deleted pending invite for call-id %s, there are now %d pending invites', 
				callId, Object.keys(self.pendingNetworkInvites).length );
		}
	}
} ;

Agent.prototype.sendAck = function( method, dialogId, req, res, opts, callback ) {
	var m = new SipMessage() ;
	m.method = method ;
	m.uri = req.uri ;
	opts = opts || {} ;

	merge( opts, {stackDialogId: dialogId}) ;

	var msgId = sendMessage( this, m, opts ) ;
	if( callback ) {
		this.pendingRequests[msgId] = function(token, msg /*, meta */) {
			if( 'OK' !== token[0] ) { return callback(token[1]) ;	}	
			callback(null, new SipMessage(msg) ) ;
		} ;
	}
} ;

Agent.prototype.proxy = function( req, opts, callback ) {
	var msg = 'proxy|' + opts.stackTxnId + '|' + (opts.remainInDialog ? 'remainInDialog' : '') + '|' + (opts.fullResponse ? 'fullResponse' : '') + '|' + 
		(opts.followRedirects ? 'followRedirects' : '') + '|' + (opts.simultaneous ? 'simultaneous' : 'serial') + '|' + opts.provisionalTimeout + '|' + opts.finalTimeout + '|' +
		opts.destination.join('|') ;

	var m = new SipMessage({
		uri: opts.destination[0],
		method: req.method
	}) ;
	if( opts.headers ) {

		for( var hdr in (opts.headers || {}) ) { 
			m.set(hdr, opts.headers[hdr]) ; 
		}
	}
	msg += CRLF + m.toString() ;


	var msgId = send( this, msg ) ;
	this.pendingRequests[msgId] = callback ;
} ;

Agent.prototype.set = function(prop, val) {
	this.params[prop] = val ;

	switch( prop ) {
		case 'api logger':
			this.apiLogger = logger(val) ;
			break ;
		case 'handler':
			this.cb = val ;
			break ;

		default:
			break ;
	}
} ;

Agent.prototype.get = function(prop) {
	return this.params[prop] ;
} ;

// uac features
Agent.prototype.uac = Agent.prototype.request = function(request_uri, options, callback) {
	var params = normalizeParams(request_uri, options, callback) ;
	return makeRequest( this, params ) ;
} ;


//retry 
Agent.prototype.initialize_retry_vars = function () {
    this.retry_timer = null;
    this.retry_totaltime = 0;
    this.retry_delay = 150;
    this.retry_backoff = 1.7;
    this.attempts = 1;
};
Agent.prototype.connection_gone = function (why) {
	var self = this;

	// If a retry is already in progress, just let that happen
	if (this.retry_timer) {
	    return;
	}

  if (exports.debug_mode) {
      console.warn("drachtio connection is gone from " + why + " event.");
  }
  this.connected = false;
  this.ready = false;

  // If this is a requested shutdown, then don't retry
  if (this.closing) {
    this.retry_timer = null;
    if (exports.debug_mode) {
        console.warn("connection ended from quit command, not retrying.");
    }
    return;
  }

  var nextDelay = Math.floor(this.retry_delay * this.retry_backoff);
  if (this.retry_max_delay !== null && nextDelay > this.retry_max_delay) {
      this.retry_delay = this.retry_max_delay;
  } else {
      this.retry_delay = nextDelay;
  }

  if (exports.debug_mode) {
      console.log("Retry connection in " + this.retry_delay + " ms");
  }

  if (this.max_attempts && this.attempts >= this.max_attempts) {
      this.retry_timer = null;
      console.error("node_redis: Couldn't get drachtio connection after " + this.max_attempts + " attempts.");
      return;
  }

  this.attempts += 1;
  this.emit("reconnecting", {
      delay: self.retry_delay,
      attempt: self.attempts
  });
  this.retry_timer = setTimeout(function () {
      if (exports.debug_mode) {
          console.log("Retrying connection...");
      }

      self.retry_totaltime += self.retry_delay;

      if (self.connect_timeout && self.retry_totaltime >= self.connect_timeout) {
          self.retry_timer = null;
          console.error("drachtio-client: Couldn't get drachtio connection after " + self.retry_totaltime + "ms.");
          return;
      }
			self.socket = net.connect({
				port: self.port,
				host: self.host
			}) ;
			self.socket.setKeepAlive(true) ;
			self.install_listeners() ;

      self.retry_timer = null;
  }, this.retry_delay);
};


