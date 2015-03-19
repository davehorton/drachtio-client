var Agent = require('../..').Agent ;
var fs = require('fs') ;
var debug = require('debug')('drachtio-client:invite-success-uas-bye') ;

module.exports = function( config ) {

	debug('config: ', config) ;

	function handler(req,res) {
		var locals = req.agent.locals ;

		if( req.method === 'INVITE') {
			if( locals.count++ < locals.reject_ceiling ) {
				res.send(180) ;
			}
			else {
				debug('sending INVITE, count %d, config: ', locals.count, locals); 

				debug('answerDelay is %d', locals.delay) ;
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
				}) ;			
			}, 1) ;
		}
	}

	var agent = new Agent(handler) ;
	agent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
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




