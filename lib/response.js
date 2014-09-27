var sip = require('drachtio-sip') ;
var delegate = require('delegates') ;
var status_codes = require('sip-status') ;
var debug = require('debug')('drachtio-client') ;

module.exports = exports = Response ;

function Response( agent ){
	if (!(this instanceof Response)) return new Response(agent);
	var self = this ;

	this.agent = agent ;
	this.msg = new sip.SipMessage() ;

	Object.defineProperty( this, 'req', {
		get: function() { return this._req; }
		,set: function(req) {
			this._req = req ;

			//copy over the dialog-specific headers from the associated request
			['call-id','cseq','from','to'].forEach( function( hdr ){
				self.msg.set( hdr, req.get(hdr) ) ;
			}) ;
		}
	}) ;

}

Response.prototype.send = function( status, reason, opts ) {
	if( typeof status !== 'number' || !(status in status_codes) ) throw new Error('Response#send: status is required and must be a valid sip response code') ;

	if( typeof reason === 'object' ) {
		opts = reason ;
		reason = null ;
	}

	this.msg.status = status ;
	this.msg.reason = reason || status_codes[status];

	//TODO: should really not be attaching the headers and body to the response object
	//because we don't necessarily want them to go out on the final if this is a 1xx
	//pass them to sendResponse instead -- caller can explicitly 'set' headers or body on the response if 
	//they want them to be sticky

	this.agent.sendResponse( this, opts ) ;
}

delegate(Response.prototype, 'msg')
  .method('get')
  .method('set')
  .access('status')
  .access('reason')
  .getter('type') ;
