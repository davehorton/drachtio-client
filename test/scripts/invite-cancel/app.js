var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert') ;

module.exports = function( config ) {

	function handler(req,res) {
		if( req.msg.method === 'INVITE') {
			res.send(180) ;
			setTimeout( function(){
				assert(false, 'expected to receive a CANCEL request') ;
			}, 10000) ;
		}
		else if( req.msg.method === 'CANCEL') {
			res.send(200) ;
		}
	} 

	var agent = new Agent(handler) ;
	agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
	agent.connect(config.connect_opts) ;
	agent.route('invite') ;
	agent.route('cancel') ;

	return agent ;
} ;




