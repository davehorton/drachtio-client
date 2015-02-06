var sip = require('drachtio-sip') ;
var delegate = require('delegates') ;
var status_codes = require('sip-status') ;
var only = require('only') ;
var merge = require('merge') ;
var debug = require('debug')('drachtio-client') ;

module.exports = exports = Response ;

function Response( agent ){
	if (!(this instanceof Response)) return new Response(agent);
	var self = this ;

	this.agent = agent ;
	this.msg = new sip.SipMessage() ;

	Object.defineProperty( this, 'req', {
		get: function() { return this._req; }, 
		set: function(req) {
			this._req = req ;

			//copy over the dialog-specific headers from the associated request
			['call-id','cseq','from','to'].forEach( function( hdr ){
				self.msg.set( hdr, req.get(hdr) ) ;
			}) ;
			return this ;
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
}

Response.prototype.send = function( status, reason, opts, callback ) {
	if( typeof status !== 'number' || !(status in status_codes) ) {
		throw new Error('Response#send: status is required and must be a valid sip response code') ;
	}

	if( typeof reason === 'function') {
		//res.send(180, fn)
		callback = reason ;
		reason = undefined ;
	}
	else if( typeof reason === 'object' ) {
		//res.send(180, {}, fn)
		callback = opts ;
		opts = reason ;
		reason = undefined ;
	}

	opts = opts || {} ;

	this.msg.status = status ;
	this.msg.reason = reason || status_codes[status];

	//TODO: should really not be attaching the headers and body to the response object
	//because we don't necessarily want them to go out on the final if this is a 1xx
	//pass them to sendResponse instead -- caller can explicitly 'set' headers or body on the response if 
	//they want them to be sticky

	this.agent.sendResponse( this, opts, callback ) ;
} ;

Response.prototype.sendAck = function( dialogId, opts, callback ) {
	this.agent.sendAck( 'ACK', dialogId, this.req, this, opts, callback ) ;
} ;
Response.prototype.sendPrack = function( dialogId, opts, callback ) {
	var rack = this.get('rseq').toString() + ' ' + this.req.get('cseq') ;
	opts = opts || {} ;
	opts.headers = opts.headers || {} ;
	merge( opts.headers, {'RAck': rack }) ;
	this.agent.sendAck( 'PRACK', dialogId, this.req, this, opts, callback ) ;
} ;
Response.prototype.toJSON = function() {
  return( only( this, 'msg source source_address source_port protocol stackTime stackDialogId stackTxnId')) ;
} ;

delegate(Response.prototype, 'msg')
  .method('get')
  .method('getParsed')
  .method('set')
  .access('headers')
  .access('body')
  .access('status')
  .access('reason')
  .getter('raw') 
  .getter('type') ;
