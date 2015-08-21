var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var mkdirp = require( "mkdirp" );
var pack = require( "nonstop-pack" );
var rimraf = require( "rimraf" );

function getVersions( downloads, ignored ) {
	if( fs.existsSync( downloads ) ) {
		return _.map( fs.readdirSync( downloads ), function( pkg ) {
			var info = pack.parse( "", pkg );
			if( !_.contains( ignored, info.version ) ) {
				return info;
			}
		} );
	} else {
		return [];
	}
}

function getInfo( config, version ) {
	var filter = config.filter.toHash();
	var installed = path.resolve( "./installs", [ filter.project, filter.owner, filter.branch ].join( "-" ) );
	var infoPath = path.join( installed, version, ".nonstop-info.json" );
	if( fs.existsSync( infoPath ) ) {
		return JSON.parse( fs.readFileSync( infoPath ).toString() );
	} else {
		return { version: version };
	}
}

module.exports = {
	ensurePath: mkdirp.sync,
	exists: fs.existsSync,
	getVersions: getVersions,
	getInfo: getInfo,
	removeDirectory: rimraf.sync
};
