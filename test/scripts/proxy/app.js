var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert'); 
var debug = require('debug')('drachtio-client') ;

module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {

      req.proxy({
        remainInDialog: config.remainInDialog,
        destination: config.proxyTarget,
        followRedirects: config.followRedirects,
        provisionalTimeout: config.provisionalTimeout,
        finalTimeout: config.finalTimeout,
        forking: config.forking,
        headers: {
          'Subject': req.get('Subject') || 'unnamed test'
        }
      }, function(err, results){
          assert( agent.idle ); 
          agent.disconnect() ;                
      }) ;
    }
  } 


  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;

  debug('proxy - connecting with ', config.connect_opts) ;
  agent.connect(config.connect_opts) ;
  agent.route('invite') ;
  

  return agent ;
} ;




