var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert') ;
var debug = require('debug') ;

module.exports = function( config ) {

  var dialogId ;
  var count = 0 ;
  var hostport ;

  function handler(req,res) {
    if( req.method === 'INVITE') {
      if( 0 === count++ ) {
        res.send(302, { 
          headers: {
            'Contact': config.contact
          }
        }) ;
      }
      else {
        res.send(200, { 
          body: config.sdp,
          headers: {
            'Max-Forwards': req.get('Max-Forwards')
          }
        }, function(err, msg){
          dialogId = res.stackDialogId ;
        }) ;
      }
    }
    if( req.method === 'ACK' && 2 == count ) {
      setTimeout( function() {
        agent.request({
          method: 'BYE',
          stackDialogId: dialogId
        }, function( err, req){
          req.on('response', function(response){
            //all done
            assert(200 === response.status) ;
            debug('exiting..'); 
            assert( agent.idle ); 
            agent.disconnect() ;                
          }) ;
        }) ;      
      }, 1) ;
    }    
  } 

  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
  agent.connect(config.connect_opts, function( err, sipAddress ){
    hostport = sipAddress ;
  }) ;
  agent.route('invite') ;
  agent.route('ack') ;

  return agent ;
} ;




