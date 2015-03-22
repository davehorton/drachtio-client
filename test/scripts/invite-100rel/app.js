var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert') ;
var debug = require('debug')('invite-100-rel') ;

module.exports = function( config ) {

	var inviteRes ;

	function handler(req,res) {
		if( req.msg.method === 'INVITE') {
			debug('got an INVITE in 100rel app') ;
			var require = req.get('Require').toString() ;
			assert(-1 !== require.indexOf('100rel'), 'expecting 100rel to be required') ;
			inviteRes = res ;

			res.send(183, { 
				body: config.sdp,
				headers: {
					'Require': '100rel'
				}
			}) ;
		}
		else if( req.msg.method === 'PRACK') {
			res.send(200) ;

			inviteRes.send(200, { body: config.sdp}) ;
		}		
		else if( req.msg.method === 'BYE') {
			res.send(200, function(err){
				//all done
				debug('exiting..'); 
				assert(!err); 
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




