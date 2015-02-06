var assert = require('assert');
var should = require('should');
var Agent = require('../..').Agent ;

describe('Agent', function(){
  it('should throw if no callback supplied', function(){

  	var badConstructor = function() { return new Agent(); } ;
  	badConstructor.should.throw() ;
  }) ;

  it('should not throw if callback supplied', function(){

  	var cb = function(req, res) {};
  	var goodConstructor = function() { return new Agent(cb); } ;
  	goodConstructor.should.not.throw() ;
  }) ;

  it('should emit an error if connection fails', function(done){

  	var cb = function(req, res) {};
  	var agent = new Agent(cb) ;
  	agent.connect({
  		host: 'localhost',
  		port: 20033
  	}) ;
  	agent.on('error', function(err){
  		done() ;
  	}) ;
  }) ;

}) ;
