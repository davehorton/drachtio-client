var Agent = require('../../..').Agent ;
var fs = require('fs') ;
var assert = require('assert'); 
var debug = require('debug')('drachtio-client:invite-success-uas-bye') ;

module.exports = function( config ) {

	function handler(req,res) {
		var locals = req.agent.locals ;

		if( req.method === 'INVITE') {
			if( locals.count++ < locals.reject_ceiling ) {
				res.send(180) ;
			}
			else {
				setTimeout( function() {
					res.send(200, { 
						body: locals.sdp,
						headers: {
							'Max-Forwards': req.get('Max-Forwards')
						}
					}, function(err, msg){
						locals.dialogId = res.stackDialogId ;
					}) ;									
				}, locals.delay) ;
			}
		}
		else if( req.method === 'ACK') {
			setTimeout( function() {
				agent.request({
					method: 'BYE',
					stackDialogId: locals.dialogId
				}, function(err, req){
					if( err ) throw err ;
					req.on('response', function(response){
						//all done
						assert(200 === response.status) ;
						debug('exiting..'); 
						assert( agent.idle ); 
						agent.disconnect() ;								
					}); 
				}) ;
			}, 1) ;
		}
	}

	var agent = new Agent(handler) ;
	agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
	config.connect_opts.label = config.label; 
	agent.connect(config.connect_opts) ;
	agent.route('invite') ;
	agent.route('ack') ;
	agent.locals = {
		delay: config.answerDelay || 1,
		reject_ceiling: config.allowCancel || 0,
		dialogId: null, 
		count: 0,
		sdp: config.sdp
	}; 

	return agent ;
} ;




