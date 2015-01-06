var bootFile = require( './bootFile' );
var configFn = require( './config' );
var drudgeon = require( 'drudgeon' );
var fs = require( './fs' );
var fsm = require( './fsm' );
var packagesFn = require( './packages' );
var serverFn = require( './serverFsm' );

module.exports = function( customConfig ) {
	var config = configFn( customConfig );
	var packages = packagesFn( config, fs );
	var processhost = require( 'processhost' )();
	var server = serverFn( config, packages );

	return fsm( config, server, packages, processhost, drudgeon, bootFile, fs );	
};