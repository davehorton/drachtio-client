'use strict' ;

var crypto = require('crypto');
var assert = require('assert') ;
var debug = require('debug')('drachtio:client');

function DigestClient( res) {
  if (!(this instanceof DigestClient)) { return new DigestClient(res); }
  assert( typeof res === 'object', 'DigestClient: \'res\' is a required parameter') ;

  this.res = res ;
  this.req = res.req ;
  this.agent = res.agent ;

  this.nc = 0;
}

module.exports = DigestClient ;

DigestClient.prototype.authenticate = function(callback) {
  var self = this ;
  var options = this.req._originalParams.options ;  

  // get the username and password - either provided directly or via a callback
  var fn ;
  if( typeof options.auth === 'function' ) {
    fn = options.auth ;
  }
  else if( typeof options.auth === 'object' ) {
    fn = function( req, res, callback ) { return callback( null, options.auth.username, options.auth.password ) ; } ;
  }
  else {
    callback(new Error('no credentials were supplied to reply to server authentication challenge')) ;
  }

  // note: we pass the original request and the 401 (or whatever) response in case the caller wants to see it
  fn( this.req, this.res, function(err, username, password) {
    if( err ) { 
      return callback( err ); 
    }

    var challenge = parseChallenge(self.res.get('www-authenticate'));
    
    var ha1 = crypto.createHash('md5');
    ha1.update([username, challenge.realm, password].join(':'));
    var ha2 = crypto.createHash('md5');
    ha2.update([options.method, options.uri].join(':'));

    // bump CSeq
    var headers = options.headers || {};
    var seq = self.req.getParsedHeader('cseq').seq ;
    seq++ ;
    headers['Cseq'] = '' + seq + ' ' + self.req.method ;


    // Generate cnonce
    var cnonce = false;
    var nc = false;
    if (typeof challenge.qop === 'string') {
      var cnonceHash = crypto.createHash('md5');
      cnonceHash.update(Math.random().toString(36));
      cnonce = cnonceHash.digest('hex').substr(0, 8);
      nc = self.updateNC();
    }

    // Generate response hash
    var response = crypto.createHash('md5');
    var responseParams = [
      ha1.digest('hex'),
      challenge.nonce
    ];

    if (cnonce) {
      responseParams.push(nc);
      responseParams.push(cnonce);
    }

    if( !!challenge.qpop ) {
      responseParams.push(challenge.qop);
    }
    responseParams.push(ha2.digest('hex'));
    response.update(responseParams.join(':'));

    // Setup response parameters
    var authParams = {
      username: username,
      realm: challenge.realm,
      nonce: challenge.nonce,
      uri: options.uri,
      qop: challenge.qop,
      response: response.digest('hex')
    };
    if( challenge.opaque ) { authParams.opaque = challenge.opaque; }

    if (cnonce) {
      authParams.nc = nc;
      authParams.cnonce = cnonce;
    }

    headers.Authorization = compileParams(authParams);
    options.headers = headers;

    self.agent.request(options, callback ) ;

  }) ;
} ;

DigestClient.prototype.updateNC = function() {
  var max = 99999999;
  this.nc++;
  if (this.nc > max) {
    this.nc = 1;
  }
  var padding = new Array(8).join('0') + "";
  var nc = this.nc + "";
  return padding.substr(0, 8 - nc.length) + nc;
};

function compileParams(params) {
  var parts = [];
  for (var i in params) {
    parts.push(i + '="' + params[i] + '"');
  }
  return 'Digest ' + parts.join(',');
}

function parseChallenge( digest ) {
  var prefix = "Digest ";
  var challenge = digest.substr(digest.indexOf(prefix) + prefix.length);
  var parts = challenge.split(',');
  var length = parts.length;
  var params = {};
  for (var i = 0; i < length; i++) {
    var part = parts[i].match(/^\s*?([a-zA-Z0-0]+)="?(.*?)"?\s*?$/);
    if (part && part.length > 2) {
      params[part[1]] = part[2];
    }
  }
  debug('DigestChallenge#parseChallenge: params ', params) ;

  return params;
}