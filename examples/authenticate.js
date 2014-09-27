var Agent = require('..').Agent ;
var fs = require('fs') ;
var stream = fs.createWriteStream('/Users/dhorton/tmp/sip.log', {flags: 'a'}) ;
var agent = new Agent(handler, stream) ;

agent.connect({
	host: 'localhost'
	,port: 9022
	,secret: 'cymru'
}) ;

function handler(req,res) {
	console.log('handler was called for incoming request with call-id: ' + req.get('call-id') ) ;
	console.log('request object is ' + JSON.stringify(req)) ;

	res.send(486, {
		headers: {
			'User-Agent': 'drachtio 0.1',
			'X-Sent-by': 'me'
		}
	}) ;
}

agent.on('error', function(err){
	console.log('error: ' + err) ;
}) ;

agent.on('connect', function( opts ){
	console.log('successfully connected to server listening on ' + opts.hostport) ;
}) ;

agent.on('close', function() {
	console.log('socket closed') ;
}) ;

agent.route('invite') ;
agent.route('bye') ;