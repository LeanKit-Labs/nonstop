var _ = require( "lodash" );
var when = require( "when" );
var chai = require( "chai" );
var sinon = require( "sinon" );
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
require( "sinon-as-promised" );
var nock = require( "nock" );

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

describe( "Server FSM", function() {
	describe( "without downloaded or installed versions", function() {
		describe( "when starting up", function() {
			var pack = {
				download: _.noop,
				getAvailable: _.noop,
				getInstalled: _.noop,
				getInstalledInfo: _.noop,
				getDownloaded: _.noop,
				install: _.noop,
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
						.rejects(new Error( "Connection to \"http://localhost:12321/api\" could not be established" ) );

					fsm = fsmFn( config, pack, undefined );
					var transitionHandle, noConnectionHandle;
					var lastTime;
					transitionHandle = fsm.on( "transition", function( ev ) {
						if( ev.toState === "failed" && --triesLeft === 0) {
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
		 			fsm.stop();
		 			packMock.restore();
		 		} );
			} );

			describe( "with connectivity", function() {

				describe( "with newest local package", function() {
					var lastState, info;
					before( function( done ) {
						packMock = sinon.mock( pack );
						var getAvailable = packMock.expects( "getAvailable" );
						var getInstalled = packMock.expects( "getInstalled" );
						var getInstalledInfo = packMock.expects( "getInstalledInfo" );
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
							.resolves( {
								owner: "owner",
								project: "proj",
								branch: "branch",
								file: "proj~owner~branch~0.0.9~10~darwin~OSX~10.9.2~x64.tar.gz",
								version: "0.0.9-10",
								build: "10"
							} );

						getInstalledInfo
							.withArgs( "0.1.0-1" )
							.returns( {} );

						fsm = fsmFn( config, pack, "0.1.0-1" );
						var hasLatestHandle;
						hasLatestHandle = fsm.on( "hasLatest", function( latestInfo ) {
							info = latestInfo;
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

					it( "should have information on the latest install", function() {
						info.should.eql( {
							owner: "owner",
							project: "proj",
							branch: "branch",
							file: "proj~owner~branch~0.0.9~10~darwin~OSX~10.9.2~x64.tar.gz",
							version: "0.0.9-10",
							build: "10"
						} );
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
						var getInstalledInfo = packMock.expects( "getInstalledInfo" );
						var getDownloaded = packMock.expects( "getDownloaded" );
						var download = packMock.expects( "download" );
						var install = packMock.expects( "install" );
						var info = {
							project: "proj",
							owner: "owner",
							branch: "branch",
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
							.resolves( info );

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
							process.nextTick( fsm.stop.bind( fsm ) );
							fsm.off( hasNewHandle );
							fsm.off( downloadingHandle );
							fsm.off( installedHandle );
							done();
						} );

						fsm.start();
					} );

					it( "should download new version", function() {
						downloaded.should.be.true; // jshint ignore : line
					} );

					it( "should install new version", function() {
						installedVersion.should.eql( {
							project: "proj",
							owner: "owner",
							branch: "branch",
							file: "proj~owner~branch~0.0.9~10~darwin~OSX~10.9.2~x64.tar.gz",
							version: "0.0.9-10",
							build: "10"
						} );
					} );

					after( function() {
			 			packMock.restore();
			 		} );
				} );

			} );
		} );
	} );
} );
