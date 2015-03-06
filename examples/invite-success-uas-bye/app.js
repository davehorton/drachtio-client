var Agent = require('../..').Agent ;
var fs = require('fs') ;
var debug = require('debug')('drachtio-client:invite-success-uas-bye') ;

module.exports = function( config ) {

	debug('config: ', config) ;

	var dialogId ;

	var count = 0 ;
	var reject_ceiling = config.allowCancel || 0 ;

	function handler(req,res) {
		if( req.method === 'INVITE') {
			if( count++ < reject_ceiling ) {
				res.send(180) ;
			}
			else {
				debug('sending INVITE, count %d, config: ', count, config.allowCancel); 
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
		else if( req.method === 'ACK') {
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




