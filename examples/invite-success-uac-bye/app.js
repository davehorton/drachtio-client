var Agent = require('../..').Agent ;
var fs = require('fs') ;
var assert = require('assert') ;

module.exports = function( config ) {

	function handler(req,res) {
		if( req.msg.method === 'INVITE') {
			res.send(200, { body: config.sdp}) ;
		}
		else if( req.msg.method === 'BYE') {
			res.send(200, function(err) {
					//all done
					assert( agent.idle ); 
					agent.disconnect() ;								
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




