var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert') ;

var count = 0 ;
module.exports = function( config ) {

  function handler(req,res) {
    if( req.msg.method === 'INVITE') {
      count++ ;
      res.send(200, { body: config.sdp}) ;
    }
    else if( req.msg.method === 'BYE') {
      res.send(200, function(err) {
          //all done
          assert( agent.idle ); 
          agent.disconnect() ;  

          assert(2 == count) ;              
      }) ;
    }
  } 

  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
  agent.connect(config.connect_opts) ;
  agent.route('invite') ;
  agent.route('bye') ;

  return agent ;
} ;




