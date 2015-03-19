var Agent = require('../..').Agent ;
var fs = require('fs') ;
var debug = require('debug')('drachtio-client') ;

module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {
      debug('proxy config: ', config) ;

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
        if( err ) return  ;
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




