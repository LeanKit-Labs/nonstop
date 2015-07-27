var should = require( "should" ); // jshint ignore : line
var filterFn = require( "../src/filter" );

describe( "Filter", function() {
	var str, hash;

	before( function() {
		var filter = filterFn( {
			architecture: "x64",
			branch: undefined,
			build: undefined,
			owner: undefined,
			platform: "darwin",
			project: undefined,
			releaseOnly: false,
			version: undefined,
			os: {}
		} );

		filter.owner( "me" );
		filter.branch( "master" );
		filter.project( "test" );

		str = filter.toString();
		hash = filter.toHash();
	} );

	it( "should produce correct hash", function() {
		hash.should.eql( {
			architecture: "x64",
			branch: "master",
			owner: "me",
			platform: "darwin",
			project: "test"
		} );
	} );

	it( "should produce correct string", function() {
		str.should.equal( "project=test&owner=me&branch=master&architecture=x64&platform=darwin" );
	} );

} );