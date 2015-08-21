var _ = require( "lodash" );
var path = require( "path" );
var when = require( "when" );
var semver = require( "semver" );
var pack = require( "nonstop-pack" );
var indexClient = require( "./indexClient" );

function download( index, file ) {
	return index.client.download( file );
}

function getAvailable( index, ignored ) {
	return index.client.getLatest( ignored );
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

function getInstalled( config, fs, pack, ignored ) {
	var installPath = getInstallPath( config );
	ignored = ignored || [];
	return pack.getInstalled( /.*/, installPath, ignored, true )
		.then(
			function( version ) {
				if( version ) {
					return fs.getInfo( config, version );
				} else {
					return undefined;
				}
			},
			function() {
				return undefined;
			}
		);
}

function getDownloaded( config, fs, ignored ) {
	ignored = ignored || [];
	return when.promise( function( resolve ) {
		var versions = fs.getVersions( config.downloads, ignored );
		versions.sort( function( a, b ) {
			return semver.rcompare( a.version, b.version );
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

function readInfo( fs, config, version ) {
	return fs.getInfo( config, version );
}

module.exports = function( config, fs ) {
	var index = indexClient( config );
	fs = fs || require( "./fs" );

	return {
		download: download.bind( null, index ),
		getAvailable: getAvailable.bind( null, index ),
		getDownloaded: getDownloaded.bind( null, config, fs ),
		getInstalled: getInstalled.bind( null, config, fs, pack ),
		getInstallPath: getInstallPath.bind( null, config ),
		hasLatest: hasLatest,
		install: install.bind( null, fs, config ),
		getInstalledInfo: readInfo.bind( null, fs, config ),
		updateConfig: function( newConfig ) {
			_.merge( config, newConfig );
			index.update( newConfig );
		}
	};
};
