var Agent = require('../..').Agent ;
var fs = require('fs') ;

module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {
      req.proxy({
        type: config.proxyType,
        destination: config.proxyTarget
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




