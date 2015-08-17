var _ = require( "lodash" );
var path = require( "path" );
var sysInfo = require( "./sysInfo.js" )();
var filterFn = require( "./filter.js" );
var defaultDownloadPath = path.resolve( "./downloads" );
var defaultInstallPath = path.resolve( "./installs" );

function getDefaults() {
	return {
		index: {
			host: "localhost",
			api: "/api",
			frequency: 5000,
			port: 4444,
			ssl: false,
			token: "test"
		},
		package: {
			architecture: sysInfo.arch,
			branch: undefined,
			build: undefined,
			owner: undefined,
			platform: sysInfo.platform,
			project: undefined,
			releaseOnly: false,
			version: undefined,
			files: defaultDownloadPath,
			os: {}
		},
		service: {
			name: sysInfo.name,
			host: sysInfo.name,
			port: {
				local: 9090,
				public: 9090
			}
		}
	};
}

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

function buildServiceUrl( cfg ) {
	return [
		"http://",
		cfg.host,
		":",
		cfg.port.public,
		"api"
	].join( "" );
}

function buildDownloadRoot( cfg ) {
	return [
		( cfg.ssl ? "https" : "http" ),
		"://",
		cfg.host,
		":",
		cfg.port,
		cfg.packages
	].join( "" );
}

function getConfiguration( custom ) {
	var defaults = getDefaults();
	_.merge( defaults, custom );
	var cfg = require( "configya" )( {
		defaults: defaults,
		file: "./bootstrap.json"
	} );

	cfg.package.osName = cfg.package.os.name || "any";
	cfg.package.osVersion = cfg.package.os.version || "any";
	return {
		filter: filterFn( cfg.package ),
		index: cfg.index,
		package: cfg.package,
		service: cfg.service,
		downloads: defaultDownloadPath,
		installs: defaultInstallPath,
		serviceRoot: buildServiceUrl( cfg.service ),
		apiRoot: buildRootUrl( cfg.index ),
		downloadRoot: buildDownloadRoot( cfg.index )
	};
}

module.exports = getConfiguration;
