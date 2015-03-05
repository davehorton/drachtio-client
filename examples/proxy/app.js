var Agent = require('../..').Agent ;
var fs = require('fs') ;
var debug = require('debug')('drachtio-client') ;

module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {
      debug('config: ', config) ;
      
      req.proxy({
        type: config.proxyType,
        destination: config.proxyTarget,
        followRedirects: config.followRedirects,
        provisionalTimeout: config.provisionalTimeout,
        finalTimeout: config.finalTimeout
      }, function(err, results){
        if( err ) return  ;
      }) ;
    }
  } 

  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
  agent.connect(config.connect_opts) ;
  agent.route('invite') ;

  return agent ;
} ;




