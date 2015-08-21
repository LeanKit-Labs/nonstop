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
				setTimeout( function() {
					connection = client.connect();
				}, 1000 );
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
		version: status.currentVersion,
		state: status.state,
		port: config.service.port.public,
		ip: config.service.host.ip,
		host: config.service.host.name,
		name: config.service.name,
		installed: status.latestInstall,
		package: config.filter.toHash(),
		index: config.index
	};
}

function nextUpdate( op, timeout ) {
	setTimeout( op, timeout );
}

function register( config, status ) {
	checkClient( config );
	return connection
		.then( function( client ) {
			debug( "Notifying the registry" );
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

function notify( config, topic, message ) {
	if( topic && message ) {
		checkClient( config );
		return connection
			.then(
				function( client ) {
					message.topic = topic;
					message.name = config.service.name;
					return client.host.notify( message );
				},
				function( err ) {
					debug( "Could not publish notification to the registry: %s", err.stack );
				} );
	}
}

module.exports = function( config, status ) {
	var api = {
		register: register.bind( undefined, config, status ),
		notify: notify.bind( undefined, config ),
		update: update.bind( undefined, config, status )
	};

	api.register()
		.then( function() {
			nextUpdate( api.update, config.frequency );
		} );

	return api;
};
