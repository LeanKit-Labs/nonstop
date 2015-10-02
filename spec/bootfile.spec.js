var should = require( "should" );
var bootFile = require( "../src/bootFile.js" );
var path = require( "path" );

describe( "Boot file", function() {

	describe( "when JSON file exists", function() {
		var boot;
		before( function( done ) {
			bootFile.get( "./spec/existingBoot/json/" )
				.then( function( x ) {
					boot = x;
					done();
				} );
		} );

		it( "should parse boot and preboot command sets", function() {
			boot.should.eql( {
				boot: { arguments: [ "./src/index.js" ], command: "node", path: "./" },
				cwd: path.resolve( process.cwd(), "./spec/existingBoot/json" ),
				preboot: {
					one: { arguments: [ "check" ], command: "gulp", path: "./" },
					two: { arguments: [ "prep" ], command: "node", path: "./" },
				}
			} );
		} );
	} );

	describe( "when YAML file exists", function() {
		var boot;
		before( function( done ) {
			bootFile.get( "./spec/existingBoot/yaml/" )
				.then( function( x ) {
					boot = x;
					done();
				} );
		} );

		it( "should parse boot and preboot command sets", function() {
			boot.should.eql( {
				boot: { arguments: [ "./src/index.js" ], command: "node", path: "./" },
				cwd: path.resolve( process.cwd(), "./spec/existingBoot/yaml" ),
				preboot: {
					one: { arguments: [ "check" ], command: "gulp", path: "./" },
					two: { arguments: [ "prep" ], command: "node", path: "./" },
				}
			} );
		} );
	} );

	describe( "when file format is invalid", function() {
		var error;
		before( function( done ) {
			bootFile.get( "./spec/badBoot/" )
				.then( null, function( x ) {
					error = x;
					done();
				} );
		} );

		it( "should report error", function() {
			error.toString().should.equal( "Error: Failed to load a nonstop boot file with SyntaxError: Unexpected token o" );
		} );
	} );

	describe( "when file is missing", function() {
		var error;
		before( function( done ) {
			bootFile.get( "./spec/missingBoot/" )
				.then( null, function( x ) {
					error = x;
					done();
				} );
		} );

		it( "should report error", function() {
			error.toString().should.equal( "Error: No nonstop boot file was found in path ./spec/missingBoot/" );
		} );
	} );

	describe( "when path is bad", function() {
		var error;
		before( function( done ) {
			bootFile.get( "./spec/nonsense/" )
				.then( null, function( x ) {
					error = x;
					done();
				} );
		} );

		it( "should report error", function() {
			error.toString().should.equal( "Error: No nonstop boot file was found in path ./spec/nonsense/" );
		} );
	} );

} );