var bootFile = require( "./bootFile" );
var configFn = require( "./config" );
var drudgeon = require( "drudgeon" );
var status = require( "./status" );
var fount = require( "fount" );
var autohost = require( "autohost" );
var hyped = require( "hyped" )();
var fs = require( "./fs" );
var path = require( "path" );
var fsm = require( "./fsm" );
var packagesFn = require( "./packages" );
var serverFn = require( "./serverFsm" );
var registryFn = require( "./registration" );
var postal = require( "postal" );
var notifications = postal.channel( "notifications" );

module.exports = function( customConfig ) {
	var config = configFn( customConfig );
	var packages = packagesFn( config, fs );
	var processhost = require( "processhost" )();
	var server = serverFn( config, packages );
	var registry = registryFn( config, status );

	notifications.subscribe( "#", function( msg, env ) {
		if( msg && env.topic ) {
			registry.notify( env.topic, msg );
		}
	} );

	var main = fsm( config, server, packages, processhost, drudgeon, bootFile, fs );
	fount.register( "control", main );
	fount.register( "status", status );
	fount.register( "config", config );
	fount.register( "packages", packages );

	var host = hyped.createHost( autohost, {
		port: config.service.port.local,
		fount: fount,
		resources: path.resolve( __dirname, "../resource" )
	}, function() {
		host.start();
	} );
	return main;
};
