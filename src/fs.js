var _ = require( "lodash" );
var fs = require( "fs" );
var mkdirp = require( "mkdirp" );
var pack = require( "nonstop-pack" );
var rimraf = require( "rimraf" );

function getVersions( downloads, ignored ) {
	if( fs.existsSync( downloads ) ) {
		return _.map( fs.readdirSync( downloads ), function( pkg ) {
			var version = pack.parse( "", pkg ).version;
			if( !_.contains( ignored, version ) ) {
				return version;
			}
		} );
	} else {
		return [];
	}
}

module.exports = {
	ensurePath: mkdirp.sync,
	exists: fs.existsSync,
	getVersions: getVersions,
	removeDirectory: rimraf.sync
};
