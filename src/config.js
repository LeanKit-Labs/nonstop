var _ = require( 'lodash' );
var path = require( 'path' );
var sysInfo = require( './sysInfo.js' )();
var filterFn = require( './filter.js' );
var defaultDownloadPath = path.resolve( './downloads' );
var defaultInstallPath = path.resolve( './installs' );

function getDefaults() {
	return {
		index: {
			host: 'localhost',
			api: '/api',
			frequency: 300000,
			port: 12321,
			ssl: false,
			token: ''
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
		port: 9090
	};
}

function buildRootUrl( cfg ) {
	return [
		( cfg.ssl ? 'https' : 'http' ),
		'://',
		cfg.host,
		':',
		cfg.port,
		cfg.api
	].join( '' );
}

function buildDownloadRoot( cfg ) {
	return [
		( cfg.ssl ? 'https' : 'http' ),
		'://',
		cfg.host,
		':',
		cfg.port,
		cfg.packages
	].join( '' );
}

function getConfiguration( custom ) {
	var defaults = getDefaults();
	var settings = _.merge( defaults, custom );
	var cfg = require( 'configya' )( {
		defaults: { nonstop: settings },
		file: './bootstrap.json'
	} );

	cfg.nonstop.package.osName = cfg.nonstop.package.os.name || 'any';
	cfg.nonstop.package.osVersion = cfg.nonstop.package.os.version || 'any';
	return {
		filter: filterFn( cfg.nonstop.package ),
		index: cfg.nonstop.index,
		package: cfg.nonstop.package,
		downloads: defaultDownloadPath,
		installs: defaultInstallPath,
		apiRoot: buildRootUrl( cfg.nonstop.index ),
		downloadRoot: buildDownloadRoot( cfg.nonstop.index ) 
	};
}

module.exports = getConfiguration;