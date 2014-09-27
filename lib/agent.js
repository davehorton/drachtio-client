var Emitter = require('events').EventEmitter ;
var net = require('net') ;
var merge = require('merge') ;
var Request = require('./request') ;
var Response = require('./response') ;
var uuid = require('node-uuid') ;
var SipMessage = require('drachtio-sip').SipMessage ;
var debug = require('debug')('drachtio:client');
var sipLogger = require('./sip-logger') ;

module.exports = exports = Agent ;

var CR = '\r' ;
var CRLF = '\r\n' ;

function Agent( cb, stream ){
	if (!(this instanceof Agent)) return new Agent(cb);

	if( typeof cb !== 'function' ) throw new Error('Agent constructor requires a message callback function') ;

	Emitter.call(this); 

	this.cb = cb ;
	this.connected = false ;
	this.authenticated = false ;
	this.incomingMsg = '' ;
	this.pendingRequests = {} ;
	this.logger = stream ? sipLogger(stream) : function(){} ;
}
Agent.prototype.__proto__ = Emitter.prototype;

Agent.prototype.connect = function( opts, cb ) {
	if( typeof opts !== 'object' ) throw new Error('Agent#connect called with invalid args') ;

	debug('agent.connect, opts: ', opts ) ;
	var self = this ;

	merge( this, opts ) ;
	this.port = this.port || 9022 ;
	this.host = this.host || 'localhost' ;
	this.verbs = {} ;

	this.socket = net.connect({
		port: this.port
		,host: this.host
	}, cb ) ;
	this.socket.setEncoding('utf8') ;

	this.socket.on('error', this.onError.bind(this) ) ;
	this.socket.on('connect', this.onConnect.bind(this) ) ;
	this.socket.on('data', this.onData.bind( this) ) ;
	this.socket.on('close', this.onClose.bind( this ) ) ;
}

Agent.prototype.onError = function(err) {
	Emitter.prototype.emit.call( this, 'error', err ) ;
}
Agent.prototype.onConnect = function() {
	var self = this ;
	 var msgId = this.send('authenticate|' + this.secret ) ;
	 this.pendingRequests[msgId] = function(response) {
	 	debug('received response to authenticate: ' + response[0]) ;
		if( this.authenticated = ('OK' === response[0]) ) {
			Emitter.prototype.emit.call( self, 'connect', {
				hostport: response[1]
			}) ;
			debug('sucessfully authenticated, hostport is ', response[1]) ;
			self.routeVerbs() ;
		}
	 } 
}
Agent.prototype.onClose = function() {
	debug('Agent#onClose') ;
	this.connected = false ;
	Emitter.prototype.emit.call( this, 'close' ) ;
}
Agent.prototype.onData = function(msg) {
	debug('Agent#onData: ', msg) ;
	var nextFragment = '' ;
	if( 0 === this.incomingMsg.length ) {
		//start of new message
		var pos = msg.indexOf('#') ;
		if( -1 === pos || isNaN( this.incomingMsgLength = parseInt( msg.slice(0, pos) ) ) )  throw new Error('invalid message from server, did not start with length#: ' + msg) ;
		this.incomingMsg = msg.slice(pos+1) ;
		debug('received new message with expected length %d, got: %s ', this.incomingMsgLength, this.incomingMsg ) ;
	}
	else {
		//piece of a message we're in the process of assembling
		var remainderSize = this.incomingMsgLength - this.incomingMsg.length ;
		this.incomingMsg += msg.slice(0, remainderSize) ;
		nextFragment = msg.slice(remainderSize) ;
	}

	if( this.incomingMsg.length === this.incomingMsgLength ) {
		this.handle( this.incomingMsg ) ;
		this.incomingMsg = '' ;
	}

	if( nextFragment.length > 0 ) this.incomingMsg += nextFragment ;
}

/**
 * dispatch incoming messages from drachtio-server
 * @param  {Object} msg - incoming message
 */
Agent.prototype.handle = function( msg ) {
	var pos = msg.indexOf(CR) ;
	var leader = -1 == pos ? msg : msg.slice(0,pos) ;
	var token = leader.split('|') ;

	switch( token[1] ) {
	case 'sip':
		var rawMsg = msg.slice( pos+2 ) ;
		var sipMsg = new SipMessage( rawMsg ) ;
		var source = token[2] ;
		var numBytes = token[3] ;
		var protocol = token[4] ;
		var address = token[5] ;
		var port = token[6] ;
		var time = token[7] ;
		var transactionId = token[8] ;

		this.logger( source, numBytes, protocol, address, port, time, rawMsg ) ;
		if( 'network' === source ) {
			var req = new Request( sipMsg, {
				source: source
				,address: address
				,port: port
				,protocol: protocol
				,time: time
				,transactionId: transactionId
			}) ;
			var res = new Response() ;
			req.res = res ;
			res.req = req ;
			req.agent = res.agent = this ;

			this.cb( req, res ) ;

		}
		else {
			debug('received confirmation of message sent by us: %s', sipMsg) ;
			//TODO: pass up the chain, through a second callback?
		}
		break ;

	case 'response':
		var rId = token[2] ;
		if( rId in this.pendingRequests ) {
			this.pendingRequests[rId]( token.slice(3) ) ;
			delete this.pendingRequests[rId] ;
		}
		break ;

	case 'route':
		this.ackVerb( token[0] ) ;
		break ;

	case 'send-receipt':
		if( token[0] in this.pendingRequests ) {
			var cb = this.pendingRequests[token[0]] ;

			if( 'OK' !== token[2] ) cb(token[2]) ;
			else {
				var sipMsg = msg.slice( pos+2 ) ;
				cb(null, sipMsg) ;
			}
			delete this.pendingRequests[token[0]] ;		
		}
		break ;	

	default:
		throw new Error('unexpected message with type: ' + token[1]) ;		
	}

}

Agent.prototype.route = function( verb ) {
	if( verb in this.verbs ) throw new Error('duplicate route request for ' + verb) ;
	this.verbs[verb] = {
		sent: false
	} ;
	if( !this.authenticated ) return ;
	
	this.routeVerbs() ;
}

Agent.prototype.routeVerbs = function() {
	for( var verb in this.verbs ) {
		if( this.verbs[verb].sent ) continue ;

		this.verbs[verb].sent = true ;
		this.verbs[verb].acknowledged = false ;
		this.verbs[verb].rid = this.send('route|' + verb) ;
	}
}
Agent.prototype.ackVerb = function( msgId ) {
	for( var verb in this.verbs ) {
		if( this.verbs[verb].rid === msgId ) {
			this.verbs[verb].acknowledged = true ;
			debug('server has agreed to route ' + verb) ;
			return ;
		}
	}
	throw new Error('received route acknowledgement for unknown msgId ' + msgId) ;
}
Agent.prototype.send = function( msg ) {
	var msgId = uuid.v1() ;
	var s = msgId + '|' + msg ;
	this.socket.write( s.length + '#' + s ) ;
	debug('sent: ' + s) ;
	return msgId ;
}

Agent.prototype.sendResponse = function( res, opts ) {
	this.sendMessage( res.msg, merge( {stackTxnId: res.req.stackTxnId}, opts) ) ;
}

Agent.prototype,sendRequest = function( req, opts, callback ) {
	var msgId = this.sendMessage( req.msg, opts ) ;
	this.pendingRequests[msgId] = callback ;
}

Agent.prototype.sendMessage = function( msg, opts ) {
	var m = msg ;

	if( opts && (opts.headers || opts.body ) ) {
		m = new SipMessage( msg ) ;
		for( var hdr in (opts.headers || {}) ) { 
			m.set(hdr, opts.headers[hdr]) ; 
		}
		if( opts.body ) m.body = opts.body ;
	}

	var s = 'sip' ;
	if( opts && opts.stackTxnId ) {
		s += '|' + opts.stackTxnId ;
	}
	s += CRLF + m.toString() ;

	return this.send( s ) ;	
}

/**
 * disconnect from drachtio-server
 * @param  {Function} [cb] - callback that is invoked when socket is closed
 */
Agent.prototype.disconnect = function( cb ) {
	if( !this.socket ) throw new Error('socket is not connected') ;
	debug('Agent#disconnect from %s', this.host + ':' + this.port) ;
	this.socket.end() ;
}