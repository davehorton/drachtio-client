var Emitter = require('events').EventEmitter ;
var sip = require('drachtio-sip') ;
var delegate = require('delegates') ;
var only = require('only') ;
var assert = require('assert') ;
var util = require('util') ;
var merge = require('merge') ;
var noop = require('node-noop').noop;
var debug = require('debug')('drachtio-client') ;
var assert = require('assert') ;

module.exports = exports = Request ;

/**
 * An incoming or outgoing SIP request
 * @constructor
 * @param {Message} msg - the sip message being received or sent
 * @param {Message~metaData} meta - metadata about the message itself 
 */
function Request( msg, meta ){
	if (!(this instanceof Request)) { return new Request(msg); }

  Emitter.call(this); 

  Object.defineProperty( this, 'res', {
    get: function() { 
      return this._res; 
    },
    set: function(res) { 
      this._res = res; 
      return this ;
    }
  }) ;

  Object.defineProperty( this, 'isNewInvite', {
    get: function() {
      var to = this.getParsed('to') ;
      return this.method === 'INVITE' && !('tag' in to.params) ;
    }
  }) ;

  Object.defineProperty( this, 'meta', {
    set: function(meta) {
      this.source = meta.source ;
      this.source_address = meta.address ;
      this.source_port = meta.port ? parseInt(meta.port): 5060 ;
      this.protocol = meta.protocol ;
      this.stackTime = meta.time ;
      this.stackTxnId = meta.transactionId ;          
      this.stackDialogId = meta.dialogId ;          
    }
  }) ;
  Object.defineProperty( this, 'url', {
    get: function() { return this.uri; }
  }) ;

  if( msg ) {
    assert(msg instanceof sip.SipMessage) ;
    this.msg = msg ;
    this.meta = meta ;
  }
}
util.inherits(Request, Emitter) ;

/**
 * Cancel a request that was sent by the application
 * @param  {Request~cancelCallback} callback - invoked with cancel operation completes
 */
Request.prototype.cancel = function(callback) {
  if( !this.agent || this.source !== 'application') { throw new Error('Request#cancel can only be used for uac Request') ; }

  this.agent.request({
      uri: this.uri,
      method: 'CANCEL',
      stackTxnId: this.stackTxnId,
    }, callback ) ;
} ;
/**
 * This callback is invoked when the application has sent a CANCEL for a request.
 * @callback Request~cancelCallback
 * @param {Error} err - if an error occurred while attempting to send the cancel
 * @param {Request} req - the cancel request that was sent
 */

/**
 * Proxy an incoming request
 * @param  {Request~proxyOptions} opts - options governing the proxy operation
 * @param  {Request~proxyCallback} callback - callback invoked when proxy operation completes
 */
Request.prototype.proxy = function( opts, callback ) {
  if( this.source !== 'network' ) { throw new Error('Request#proxy can only be used for incoming requests') ; }
  if( typeof opts !== 'object' || !opts.destination ) { throw new Error('Request#proxy: opts.destination is required') ; }

  //TODO: throw error if req.res.send has already been called (i.e. can't start off as UAS and then become a proxy)
  var destination = opts.destination;
  if( typeof destination === 'string') { opts.destination = [destination] ; }
  
  merge( opts, {
    stackTxnId: this.stackTxnId,
    remainInDialog: opts.remainInDialog || false,
    provisionalTimeout: opts.provisionalTimeout || '',
    finalTimeout: opts.finalTimeout || '',
    followRedirects: opts.followRedirects || false,
    simultaneous: opts.forking === 'simultaneous',
    fullResponse: callback.length === 2
  }) ;
 
  //normalize sip uris
  opts.destination.forEach( function(value, index, array){
    var token = value.split(':') ;
    if( token[0] !== 'sip' && token[0] !== 'tel') {
      array[index] = 'sip:' + value ;
    }
  }) ;

  var result = {
    connected: false,
    responses: []
  } ;

  this.agent.proxy( this, opts, function( token, rawMsg, meta){
    if( 'NOK' === token[0] ) {
      return callback( token[1] ) ;
    }
    if( 'done' === token[1] ) {
      result.connected = (200 === result.finalStatus) ;
      return callback( null, result) ;
    }
    else {
      //add a new response to the array
      var address = meta.address ;
      var port = ~~meta.port ;
      var msg = new sip.SipMessage( rawMsg ) ;
      var obj = {
        time: meta.time,
        status: msg.status,
        msg: msg
      } ;
      var len = result.responses.length ;
      if( len === 0 || address !== result.responses[len-1].address || port === result.responses[len-1].port ) {
        result.responses.push({
          address: address,
          port: port,
          msgs:[]
        }) ;
        len++ ;
      }
      result.responses[len-1].msgs.push( obj ) ;
      result.finalStatus = msg.status ;
      result.finalResponse = obj ;
    }
  }) ;
} ;
/**
 * Options governing a proxy operation
 * @typedef {Object} Request~proxyOptions
 * @property {string|Array} destination - an ordered list of one or more SIP URIs to proxy the request to
 * @property {boolean} [remainInDialog=false] - if true add a Record-Route header and emain in the SIP dialog after the INVITE transaction.
 * @property {boolean} [followRedirects=false] - if true respond to 3XX redirect responses by generating a new INVITE to the SIP URI in the Contact header of the response
 * @property {string} [forking=sequential] - 'simultaneous' or 'sequential'; dicates whether the proxy waits for a failure response from one target before trying the next, or forks the request to all targets simultaneously
 * @property {string} [provisionalTimeout] - amount of time to wait for a 100 Trying response from a target before trying the next target; valid syntax is '2s' or '1500ms' for example
 * @property {string} [finalTimeout] - amount of time to wait for a final response from a target before trying the next target; syntax is as described above for provisionalTimeout
*/
/**
 * This callback is invoked when proxy operation has completed.
 * @callback Request~proxyCallback
 * @param {Error} err - if an error occurred while attempting to proxy the request
 * @param {Request~proxyResults} results - results summarizing the proxy operation
 */


Request.prototype.toJSON = function() {
  return( only( this, 'msg source source_address source_port protocol stackTime stackDialogId stackTxnId')) ;
} ;

// for compatibility with passport
Request.prototype.logIn = function(user, options, done) {
  debug('Request#logIn: user: ', user) ;
  if (typeof options === 'function') {
    done = options;
    options = {};
  }
  options = options || {};
  done = done || noop ;
  
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  var session = (options.session === undefined) ? true : options.session;
  
  this[property] = user;
  if (session) {
    if (!this._passport) { throw new Error('passport.initialize() middleware not in use'); }
    if (typeof done !== 'function') { throw new Error('req#login requires a callback function'); }
    
    var self = this;
    this._passport.instance.serializeUser(user, this, function(err, obj) {
      if (err) { self[property] = null; return done(err); }
      if (!self._passport.session) {
        self._passport.session = {};
      }
      self._passport.session.user = obj;
      if (!self.session) {
        self.session = {};
      }
      self.session[self._passport.instance._key] = self._passport.session;
      done();
    });
  } else {
    done();
  }
};

// Terminate an existing login session.
Request.prototype.logOut = function() {
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  
  this[property] = null;
  if (this._passport && this._passport.session) {
    delete this._passport.session.user;
  }
};

// Test if request is authenticated.
Request.prototype.isAuthenticated = function() {
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  
  return (this[property]) ? true : false;
};

// Test if request is unauthenticated.
Request.prototype.isUnauthenticated = function() {
  return !this.isAuthenticated();
};


delegate(Request.prototype, 'msg')
  .method('get')
  .method('has')
  .method('getParsedHeader')
  .method('set')
  .access('method')
  .access('uri')
  .access('headers')
  .access('body')
  .getter('type')
  .getter('raw') 
  .getter('callingNumber')
  .getter('calledNumber')
  .getter('canFormDialog') ;

/**
 * response event triggered when a Request sent by the application receives a response from the network
 * @event Endpoint#destroy
 * @param {Response} res - SIP response received as a result of sending a SIP request
 */
