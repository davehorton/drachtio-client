/**
 * Module dependencies.
 */
var merge = require('merge') ;

/**
 * Default log buffer duration.
 */

var defaultBufferDuration = 1000;

exports = module.exports = function logger(options) {
  var opts = {}  ;

  if ( typeof options.write === 'function' ) {
    opts.stream = options ;
  }
  else {
    merge( opts, options ) ;
  }

  // options
  var stream = opts.stream || process.stdout ;
  var buffer = opts.buffer;

  // buffering support
  if (buffer) {
    var realStream = stream ;
    var buf = [] ;
    var timer = null ;
    var interval = 'number' === typeof buffer ? buffer : defaultBufferDuration ;

    // flush function
    var flush = function(){
      timer = null ;

      if (buf.length) {
        realStream.write(buf.join(''));
        buf.length = 0;
      }
    } ;

    // swap the stream
    stream = {
      write: function(str){
        if (timer === null) {
          timer = setTimeout(flush, interval) ;
        }

        buf.push(str);
      }
    };
  }

  return function logger(source, numBytes, protocol, address, port, time, sipMsg) {
    if( arguments.length === 1 ) {
      //basic logger
      stream.write( source ) ;
    }
    else {
      //sip logger
      var str = ('network' === source ? 'recv ': 'sent ') + numBytes + ' bytes ' + ('network' === source ? 'from ': 'to ') + protocol + '/' + address + ':' + port + ' at ' + time + '\n' + sipMsg + '\n';

      stream.write(str);      
    }
  };
};

