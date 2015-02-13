var Agent = require('./lib/agent') ;
var Request = require('./lib/request') ;
var Response = require('./lib/response') ;
var onSend = require('./lib/onSend') ;

exports = module.exports = {
	Agent: Agent,
	Request: Request,
	Response: Response,
	onSend: onSend
} ;