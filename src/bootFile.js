var _ = require( "lodash" );
var yaml = require( "js-yaml" );
var when = require( "when" );
var fs = require( "fs" );
var path = require( "path" );
var drudgeon = require( "drudgeon" );
var glob = require( "globulesce" );

function getBuildFile( installPath ) {
	return when.promise( function( resolve, reject ) {
		if( fs.existsSync( installPath ) ) {
			glob( installPath, "{**,.}/*boot.{json,yaml}" )
				.then( function( matches ) {
					if( _.isEmpty( matches ) ) {
						reject( new Error( "No nonstop boot file was found in path " + installPath ) );
					} else {
						try {
							var file = matches[ 0 ];
							var content = fs.readFileSync( file );
							var ext = path.extname( file );
							var cwd = path.resolve( process.cwd(), file );
							var config;
							if( ext === ".json" ) {
								config = parseJson( content );
							} else {
								config = parseYaml( content );
							}
							config.cwd = path.dirname( cwd );
							if( config.boot ) {
								config.boot = drudgeon.readSet( config ).boot;
							}
							if( config.preboot ) {
								config.preboot = drudgeon.readSet( config.preboot );
							}
							resolve( config );
						} catch ( e ) {
							reject( new Error( "Failed to load a nonstop boot file with " + e ) );
						}
					}
				} );
		} else {
			reject( new Error( "No nonstop boot file was found in path " + installPath ) );
		}
	} );
}

function parseYaml( content ) {
	return yaml.safeLoad( content.toString() );
}

function parseJson( content ) {
	return JSON.parse( content );
}

module.exports = {
	get: getBuildFile
};
