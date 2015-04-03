var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var debug = require('debug')('drachtio-client:cdr') ;

module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {
      debug('config: ', config) ;
      
      req.proxy({
        destination: config.proxyTarget,
        followRedirects: config.followRedirects
      }, function(err, results){
        if( err ) return  ;
      }) ;
    }
  } 

  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
  config.connect_opts.methods = [] ;

  var attempt = [] ;
  var start = [] ;
  var stop = [] ;
/*
  agent.on('cdr:attempt', function(cdr){
    debug('got an attempt cdr'); 
    attempt.push( cdr ) ;
  }) ;
  agent.on('cdr:start', function(cdr){
    start.push( cdr ) ;
  }) ;
  agent.on('cdr:stop', function(cdr){
    stop.push( cdr ) ;
  }) ;
*/
  agent.getStartCdr = function() { 
    return start; 
  }  ;
  agent.getAttemptCdr = function() {
    return attempt ;
  } ;
  agent.getStopCdr = function() { 
    return stop; 
  } ;

  agent.connect(config.connect_opts) ;

  if( !config.cdrOnly ) agent.route('invite') ;

  return agent ;
} ;




