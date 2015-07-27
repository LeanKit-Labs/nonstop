var should = require( "should" );
var when = require( "when" );
var semver = require( "semver" );
var fsmFn = require( "../src/serverFsm.js" );
var path = require( "path" );
var config = require( "../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: {
		project: "test",
		owner: "me",
		branch: "master",
		files: "./downloads"
	}
} );

var sinon = require( "sinon" );
var nock = require( "nock" );

describe( "Server FSM", function() {
	describe( "without downloaded or installed versions", function() {
		describe( "when starting up", function() {
			var noop = function() {};

			var pack = {
				download: noop,
				getAvailable: noop,
				getInstalled: noop,
				getDownloaded: noop,
				install: noop,
				hasLatest: function( installed, available ) {
					return semver.gte( installed, available );
				}
			};
			var client = {

			};

			var index = sinon.stub();
			index.returns( client );
			var fsm, lastAction, packMock;

		 	describe( "without connectivity", function() {
		 		var attempts = 0;
		 		var timings = [];
		 		before( function( done ) {
					packMock = sinon.mock( pack );
					var getAvailable = packMock.expects( "getAvailable" );
					var getInstalled = packMock.expects( "getInstalled" );
					var getDownloaded = packMock.expects( "getDownloaded" );
					var triesLeft = 5;
					getInstalled
						.withArgs( [] )
						.returns( when( undefined ) );

					getDownloaded
						.withArgs( [] )
						.returns( when( undefined ) );

					getAvailable
						.atMost( 10 )
						.returns( when.reject( new Error( "Connection to \"http://localhost:12321/api\" could not be established" ) ) );

					fsm = fsmFn( config, pack, undefined );
					var transitionHandle, noConnectionHandle;
					var lastTime;
					transitionHandle = fsm.on( "transition", function( ev ) {
						if( ev.toState === "waiting" && --triesLeft === 0) {
							fsm.off( transitionHandle );
							fsm.off( noConnectionHandle );
							lastAction = ev.action;
							fsm.stop();
							done();
						}
						if( ev.toState !== "stopped" && ev.action === "checkingForNew.available.failed" ) {
							if( lastTime ) {
								// round the timings down to the nearest 100
								timings.push( Math.floor( ( Date.now() - lastTime ) / 10 ) * 10 );
							}
							lastTime = Date.now();
						}
					} );

					noConnectionHandle = fsm.on( "noConnection", function() {
						attempts ++;
					} );

					fsm.start();
		 		} );

		 		it( "should transition to waiting from failing to connect", function() {
		 			lastAction.should.equal( "checkingForNew.available.failed" );
		 		} );

		 		it( "should retry repeatedly", function() {
		 			attempts.should.equal( 5 );
		 		} );

				it( "should decay retry frequency", function() {
					timings.should.eql( [ 100, 200, 300, 400 ] );
				} );

		 		after( function() {
		 			packMock.restore();
		 		} );
			} );

			describe( "with connectivity", function() {

				describe( "with newest local package", function() {
					var lastState;
					before( function( done ) {
						packMock = sinon.mock( pack );
						var getAvailable = packMock.expects( "getAvailable" );
						var getInstalled = packMock.expects( "getInstalled" );
						var getDownloaded = packMock.expects( "getDownloaded" );
						var triesLeft = 5;
						getInstalled
							.withArgs( [ "0.1.0" ] )
							.returns( when( undefined ) );

						getDownloaded
							.withArgs( [] )
							.returns( when( undefined ) );

						getAvailable
							.atMost( 10 )
							.returns( when( {
								file: "proj~owner~branch~0.0.9~10~darwin~OSX~10.9.2~x64.tar.gz",
								version: "0.0.9-10",
								build: "10"
							} ) );

						fsm = fsmFn( config, pack, "0.1.0-1" );
						var hasLatestHandle;
						hasLatestHandle = fsm.on( "hasLatest", function() {
							fsm.off( hasLatestHandle );
							lastState = fsm.state;
							fsm.stop();
							done();
						} );
						fsm.start();
					} );

					it( "should transition to waiting", function() {
						lastState.should.equal( "waiting" );
					} );

					after( function() {
			 			packMock.restore();
			 		} );
				} );

				describe( "with old local package", function() {
					var installedVersion, notifiedOfNew, downloaded;
					before( function( done ) {
						packMock = sinon.mock( pack );
						var getAvailable = packMock.expects( "getAvailable" );
						var getInstalled = packMock.expects( "getInstalled" );
						var getDownloaded = packMock.expects( "getDownloaded" );
						var download = packMock.expects( "download" );
						var install = packMock.expects( "install" );
						var info = {
							file: "proj~owner~branch~0.0.9~10~darwin~OSX~10.9.2~x64.tar.gz",
							version: "0.0.9-10",
							build: "10"
						};

						getInstalled
							.withArgs( [ "0.1.0" ] )
							.returns( when( undefined ) );

						getDownloaded
							.withArgs( [] )
							.returns( when( undefined ) );

						getAvailable
							.atMost( 10 )
							.returns( when( info ) );

						download.returns( when( info ) );

						install
							.withArgs( path.resolve( "./downloads", info.file ) )
							.returns( when( true ) );

						fsm = fsmFn( config, pack, "0.0.8-1" );
						var hasNewHandle, downloadingHandle, installedHandle;

						hasNewHandle = fsm.on( "hasNew", function() {
							notifiedOfNew = true;
						} );

						downloadingHandle = fsm.on( "downloaded", function() {
							downloaded = true;
						} );

						installedHandle = fsm.on( "installed", function( version ) {
							installedVersion = version;
							fsm.off( hasNewHandle );
							fsm.off( downloadingHandle );
							fsm.off( installedHandle );
							fsm.stop();
							done();
						} );

						fsm.start();
					} );

					it( "should download new version", function() {
						downloaded.should.be.true; // jshint ignore : line
					} );

					it( "should install new version", function() {
						installedVersion.should.equal( "0.0.9-10" );
					} );

					after( function() {
			 			packMock.restore();
			 		} );
				} );

			} );
		} );
	} );
} );
