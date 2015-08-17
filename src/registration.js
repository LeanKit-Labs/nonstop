var halon = require( "halon" );
var request = require( "request" );
var debug = require( "debug" )( "nonstop:registry" );
var registryClient, connection;

function buildRootUrl( cfg ) {
	return [
		( cfg.ssl ? "https" : "http" ),
		"://",
		cfg.host,
		":",
		cfg.port,
		cfg.api
	].join( "" );
}

function checkClient( config ) {
	if( !registryClient ) {
		var opts = {
			root: buildRootUrl( config.index ),
			adapter: halon.requestAdapter( request ),
		};
		if( config.index.token ) {
			opts.headers = {
				authorization: "Bearer " + config.index.token
			};
		}
		registryClient = halon( opts );
		connection = registryClient
			.on( "rejected", function( client, err ) {
				debug( "Failed to connect to registry at %s:%d with %s. Retrying.", config.index.host, config.index.port, err.stack );
				connection = client.connect();
			}, true )
			.connect();
	}
}

function getStatus( config, status ) {
	return {
		uptime: {
			host: status.uptime,
			service: status.serviceUptime
		},
		package: config.filter.toHash(),
		version: status.currentVersion,
		state: status.state,
		index: config.index,
		port: config.service.port.public,
		host: config.service.host,
		name: config.service.name
	};
}

function nextUpdate( op, timeout ) {
	setTimeout( op, timeout );
}

function register( config, status ) {
	checkClient( config );
	return connection
		.then( function( client ) {
			debug( "Calling register" );
			return client.host.register( getStatus( config, status ) );
		} );
}

function update( config, status ) {
	checkClient( config );
	var op = function() {
		update( config, status );
	};
	return connection
		.then( function( client ) {
			return client.host.update( {
				name: config.service.name,
				body: getStatus( config, status )
			} )
				.then(
					function() {
						nextUpdate( op, config.index.frequency );
					},
					function() {
						nextUpdate( op, config.index.frequency );
					} );
		} );
}

module.exports = function( config, status ) {
	var api = {
		register: register.bind( undefined, config, status ),
		update: update.bind( undefined, config, status )
	};

	api.register()
		.then( function() {
			nextUpdate( api.update, config.frequency );
		} );

	return api;
};
