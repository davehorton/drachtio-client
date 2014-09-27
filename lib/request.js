var sip = require('drachtio-sip') ;
var delegate = require('delegates') ;
var only = require('only') ;
var assert = require('assert') ;

module.exports = exports = Request ;


function Request( msg, meta ){
	if (!(this instanceof Request)) return new Request(msg);

  assert(msg instanceof sip.SipMessage) ;

	this.msg = msg ;
  this.source = meta.source ;
  this.source_address = meta.address ;
  this.source_port = meta.port ? parseInt(meta.port): 5060 ;
  this.protocol = meta.protocol ;
  this.stackTime = meta.time ;
  this.stackTxnId = meta.transactionId ;

  Object.defineProperty( this, 'res', {
    get: function() { return this._res; }
    ,set: function(res) { return this._res = res; }
  }) ;

}

Request.prototype.toJSON = function() {
  return( only( this, 'msg source source_address source_port protocol stackTime'))
}

delegate(Request.prototype, 'msg')
  .method('get')
  .method('set')
  .access('method')
  .access('url')
  .getter('type')
  .getter('canFormDialog') ;
