var Agent = require('../../..').Agent ;
var fs = require('fs') ;

module.exports = function( config ) {

	function handler(req,res) {
		if( req.msg.method === 'OPTIONS') {
			res.send(200, {
				headers: {
					'X-Custom': 'drachtio rocks!'
				}
			}) ;
		}
		else if( req.msg.method === 'MESSAGE') {
			res.send(200, {
				headers: {
					'subject': 'pure awesomeness'
				}
			}) ;
		}	
	} 

	var agent = new Agent(handler) ;
	agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
	agent.connect(config.connect_opts) ;
	agent.route('options') ;
	agent.route('message') ;

	return agent ;
} ;




