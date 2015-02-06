var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var localAgent;
var remoteAgent;

var noop = function(req,res){} ;

describe('custom headers', function() {
    this.timeout(3000) ;

    before(function(done){
       remoteAgent = require('../../examples/custom-headers/app')(require('./fixtures/remoteConfig')) ;
        remoteAgent.on('connect', function() {
            localAgent = require('../..').Agent(noop) ;
            localAgent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
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
 
    it('must be able to set a custom header', function(done) {
        localAgent.request({
            uri: config.request_uri,
            method: 'OPTIONS'
        }, function( err, req ) {
            should.not.exist(err) ;
            req.on('response', function(res){
                res.should.have.property('status',200); 
                should(res.get('X-Custom').value).eql('drachtio rocks!') ;
                localAgent.idle.should.be.true ;
                remoteAgent.idle.should.be.true ;
                done() ;
            }) ;
        }) ;
    }) ;

    it('must be able to set a well-known header', function(done) {
        localAgent.request({
            uri: config.request_uri,
            method: 'MESSAGE'
        }, function( err, req ) {
            should.not.exist(err) ;
            req.on('response', function(res){
                res.should.have.property('status',200); 
                should(res.get('Subject').value).eql('pure awesomeness') ;
                localAgent.idle.should.be.true ;
                remoteAgent.idle.should.be.true ;
                done() ;
            }) ;
        }) ;
    }) ;
}) ;
