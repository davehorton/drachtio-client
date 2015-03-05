var Agent = require('../..').Agent ;
var fs = require('fs') ;

module.exports = function( config ) {

  var dialogId ;
  var count = 0 ;

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
        }) ;      
      }, 1) ;
    }    
  } 

  var agent = new Agent(handler) ;
  agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
  agent.connect(config.connect_opts) ;
  agent.route('invite') ;
  agent.route('ack') ;

  return agent ;
} ;




