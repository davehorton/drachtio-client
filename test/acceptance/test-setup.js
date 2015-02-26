var spawn = require('child_process').spawn ;
var exec = require('child_process').exec ;
var localServer ;
var remoteServer ;
var remoteServer2 ;

before( function(done){
    exec('pkill drachtio', function () {
        localServer = spawn('drachtio',['-f','./fixtures/drachtio.conf.local.xml'],{cwd: process.cwd() + '/test/acceptance'}) ;
        remoteServer = spawn('drachtio',['-f','./fixtures/drachtio.conf.remote.xml'],{cwd: process.cwd() + '/test/acceptance'}) ;
        remoteServer2 = spawn('drachtio',['-f','./fixtures/drachtio.conf.remote2.xml'],{cwd: process.cwd() + '/test/acceptance'}) ;
        done() ;
     }) ;
}) ;

after( function(done) {
    this.timeout(1000) ;
    setTimeout( function() {
        localServer.kill() ;
        remoteServer.kill() ;
        remoteServer2.kill() ;
        done() ;
    }, 250) ;
}) ;

