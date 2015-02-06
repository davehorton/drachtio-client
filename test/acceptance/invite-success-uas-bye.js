var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var merge = require('merge') ;
var localAgent;
var remoteAgent;

var noop = function(req,res){} ;

describe('invite success then uas sends bye', function() {
    this.timeout(3000) ;

    before(function(done){
        var mockedConfig = require('./fixtures/remoteConfig') ;
       remoteAgent = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {
            localAgent = require('../..').Agent(noop) ;
            localAgent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
            localAgent.route('bye'); 
            localAgent.connect(config.connect_opts, function(err){
                done() ;
            });        
        }) ;
    }) ;
    after(function(done){
        localAgent.disconnect() ;
        remoteAgent.disconnect() ;
        done() ;
    }) ;
 
    it('must be able to complete an INVITE then tear down from uas side', function(done) {
        //
        //install a handler for the BYE request
        //
        localAgent.set('handler', function( req, res){
            req.method.should.eql('BYE') ;
            res.send(200, function(err, bye){
                should.not.exist(err) ;
                localAgent.idle.should.be.true; 
                setTimeout(function(){
                    remoteAgent.idle.should.be.true; 
                    done() ;
                }, 50) ;
            }) ;
        }) ;
        //
        //send INVITE
        //
        localAgent.request({
            uri: config.request_uri,
            method: 'INVITE',
            body: config.sdp
        }, function( err, req ) {
            should.not.exist(err) ;
            //
            //wait for response
            //
            req.on('response', function(res, ack){
                //
                //validate response and send ack
                //
                res.should.have.property('status',200);
                ack() ; 
            }) ;
        }) ;
    }) ;
}) ;
