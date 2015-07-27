var path = require( "path" );
var when = require( "when" );
var lift = require( "when/node" ).lift;
var _ = require( "lodash" );
var debug = require( "debug" )( "nonstop:packages" );
var semver = require( "semver" );
var pack = require( "nonstop-pack" );
var index = require( "nonstop-index-client" );

function download( client, file ) {
	return client.download( file );
}

function getAvailable( client, ignored ) {
	return client.getLatest( ignored );
}

function getInstallPath( config, version ) {
	var filter = config.filter.toHash();
	var target = [ filter.project, filter.owner, filter.branch ].join( "-" );
	var targetPath;
	if( version ) {
		targetPath = path.join( config.installs, target, version );
	} else {
		targetPath = path.join( config.installs, target );
	}
	return targetPath;
}

function getInstalled( config, pack, ignored ) {
	var installPath = getInstallPath( config );
	ignored = ignored || [];
	return pack.getInstalled( /.*/, installPath, ignored, true )
		.then( null, function() {
			return undefined;
		} );
}

function getDownloaded( config, fs, ignored ) {
	ignored = ignored || [];
	return when.promise( function( resolve ) {
		var versions = fs.getVersions( config.downloads, ignored );
		versions.sort( function( a, b ) {
			return semver.rcompare( a, b );
		} );
		if( versions.length ) {
			resolve( versions[ 0 ] );
		} else {
			resolve( undefined );
		}
	} );
}

function hasLatest( installed, available ) {
	return semver.gte( installed, available );
}

function install( fs, config, package ) {
	var info = pack.parse( "", package );
	var installPath = getInstallPath( config, info.version );
	fs.ensurePath( path.dirname( installPath ) );
	return pack.unpack( package, installPath );
}

module.exports = function( config, fs ) {
	var client = index( {
		index: config.index,
		nonstop: config.package
	} );

	fs = fs || require( "./fs" );

	return {
		download: download.bind( null, client ),
		getAvailable: getAvailable.bind( null, client ),
		getDownloaded: getDownloaded.bind( null, config, fs ),
		getInstalled: getInstalled.bind( null, config, pack ),
		getInstallPath: getInstallPath.bind( null, config ),
		hasLatest: hasLatest,
		install: install.bind( null, fs, config )
	};
};