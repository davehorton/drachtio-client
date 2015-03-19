var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var merge = require('merge') ;
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var debug = require('debug')('drachtio-client') ;
var async = require('async') ;
var spawn = require('child_process').spawn ;
var exec = require('child_process').exec ;

var uacServer, proxyServer, uas1Server, uas2Server ;
var uac, proxy, uas1, uas2;
var uacConfig, proxyConfig, uas1Config, uas2Config;

uacConfig = require('./fixtures/localConfig') ;
proxyConfig = require('./fixtures/remoteConfig') ;
uas1Config = require('./fixtures/remoteConfig2') ;
uas2Config = require('./fixtures/remoteConfig2') ;

uacConfig.connect_opts.port = 8040; uacConfig.sipAddress = 'sip:127.0.0.1:6070';
proxyConfig.connect_opts.port = 8041; proxyConfig.sipAddress = 'sip:127.0.0.1:6071';
uas1Config.connect_opts.port = 8042; uas1Config.sipAddress = 'sip:127.0.0.1:6072';
uas2Config.connect_opts.port = 8043; uas2Config.sipAddress = 'sip:127.0.0.1:6073';

debug('cdr: uacConfig: ', uacConfig) ;

function configureUac( config ) {
    debug('configureUac: ', config) ;
    uac = require('../..').Agent(function(req,res){}) ;
    uac.set('api logger',fs.createWriteStream(config.apiLog) ) ;
    uac.connect(config.connect_opts) ;
    return uac ;
}
function connectAll( agents, cb ) {
    async.each( agents, function( agent, callback ) {
        if( agent.connected ) agent.disconnect() ;
        agent.on('connect', function(err) {
            return callback(err) ;
        }) ;
    }, function(err) {
        if( err ) return cb(err) ;
        cb() ;
    }) ;
}

describe.only('cdr', function() {
    this.timeout(6000) ;

     before(function(done){
        debug('spinning up servers') ;
        //exec('pkill drachtio', function () {
            uacServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.local.xml','-p',8040,'-c','sip:127.0.0.1:6070'],{cwd: process.cwd() + '/test/acceptance'}) ;
            proxyServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote.xml','-p',8041,'-c','sip:127.0.0.1:6071'],{cwd: process.cwd() + '/test/acceptance'}) ;
            uas1Server = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote2.xml','-p',8042,'-c','sip:127.0.0.1:6072'],{cwd: process.cwd() + '/test/acceptance'}) ;
            uas2Server = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote3.xml','-p',8043,'-c','sip:127.0.0.1:6073'],{cwd: process.cwd() + '/test/acceptance'}) ;
             done() ;
        //}) ;
    }) ;
    after(function(done){
        debug('turning down servers') ;
        this.timeout(1000) ;
        setTimeout( function() {
            uacServer.kill() ;
            proxyServer.kill() ;
            uas1Server.kill() ;
            uas2Server.kill() ;
            done() ;
        }, 250) ;
    }) ;
 
    it('should write attempt and stop records when no clients connected', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/cdr/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            cdrOnly: true            
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(uas1Config) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;
            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                body: config.sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',503); 
                    ack() ;
                    setTimeout(function(){
                        should.exist( proxy.getAttemptCdr() ) ;
                        should.exist( proxy.getStopCdr() ) ;
                        done() ;                        
                    }, 100) ;
                }) ;
            }) ;            
        }) ;
    }) ;    
}) ;
