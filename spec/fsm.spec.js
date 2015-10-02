var should = require( "should" ); // jshint ignore : line
var path = require( "path" );
var fsmFn = require( "../src/fsm.js" );
var config = require( "../src/config.js" )( {
	index: {
		frequency: 100
	},
	package: {  // jshint ignore : line
		branch: "master",
		owner: "me",
		project: "test"
	}
} );
var _ = require( "lodash" );
var when = require( "when" );
var sinon = require( "sinon" );
require( "sinon-as-promised" );

describe.only( "FSM", function() {
	var noop = function() {};
	var server = {
		start: function() {
			this.raise( "started" );
		},
		subscriptions: {},
		clear: function() {
			this.started = {};
			this.subscriptions = {};
		},
		install: function( version ) {
			this.raise( "installed", version );
		},
		on: function( topic, handle ) {
			var subscriptions = this.subscriptions[ topic ];
			subscriptions = subscriptions || [];
			subscriptions.push( handle );
			this.subscriptions[ topic ] = subscriptions;
		},
		raise: function( ev ) {
			var args = Array.prototype.slice.call( arguments, 1 );
			_.each( this.subscriptions[ ev ], function( sub ) {
				sub.apply( undefined, args );
			} );
		}
	};
	var pack = {
		getAvailable: noop,
		getInstalled: noop,
		getInstalledInfo: noop,
		getInstallPath: noop,
		getDownloaded: noop,
	};

	var processhost = {
		started: {},
		failed: {},
		stopped: false,
		subscriptions: {},
		clear: function() {
			this.started = {};
			this.subscriptions = {};
		},
		on: function( topic, handle ) {
			this.subscriptions[ topic ] = handle;
		},
		fail: function( alias, err ) {
			this.failed[ alias ] = true;
			var handle = this.subscriptions[ alias + ".failed" ];
			if( handle ) {
				handle( err );
			}
		},
		create: function( alias, cfg ) {
			this.started[ alias ] = cfg;
		},
		start: function( alias ) {
			var handle = this.subscriptions[ alias + ".started" ];
			if( handle ) {
				handle();
			}
		},
		stop: function() {
			this.stopped = true;
		}
	};
	var bootFile = {
		get: noop
	};
	var fs = {
		exists: noop
	};

	var fsm, lastAction, packMock, fsMock;

	describe( "without downloaded or installed versions", function() {

		describe( "when starting up", function() {
			describe( "without connectivity", function() {
		 		var lastState;
		 		before( function( done ) {
					packMock = sinon.mock( pack );
					fsMock = sinon.mock( fs );
					var getInstalled = packMock.expects( "getInstalled" );
					var getDownloaded = packMock.expects( "getDownloaded" );
					var getInstallPath = packMock.expects( "getInstallPath" );
					var getAvailable = packMock.expects( "getAvailable" );

					getInstalled
						.returns( when( undefined ) );

					getInstallPath
						.withArgs( "0.0.0" )
						.returns( "./installs/0.0.0" );

					getDownloaded
						.withArgs( [] )
						.returns( when( undefined ) );

					getAvailable
						.withArgs( [] )
						.returns( when( undefined ) );

					server.on( "started", function() {
						server.raise( "noConnection" );
					} );

					fsMock.expects( "exists" )
						.withArgs( "/git/labs/nonstop/nonstop/installs/test-me-master" )
						.returns( false );

					fsm = fsmFn( config, server, pack, processhost, {}, bootFile, fs );
					var waitingHandle;
					waitingHandle = fsm.on( "waiting", function() {
						fsm.off( waitingHandle );
						lastState = fsm.state;
						done();
					} );
		 		} );

		 		it( "should resolve to waiting state", function() {
		 			lastState.should.equal( "waiting" );
		 		} );

		 		after( function() {
		 			fsMock.restore();
		 			packMock.restore();
		 			server.clear();
		 		} );
		 	} );

	 		describe( "with latest version installed", function() {
	 			var lastState, prebooted, info;
	 			var bootFileMock, drudgeonMock;

		 		before( function( done ) {
		 			var versionPath = path.resolve( "./installs/test-me-master" );
		 			fsMock = sinon.mock( fs );
		 			bootFileMock = sinon.mock( bootFile );
		 			var getFile = bootFileMock.expects( "get" );

		 			drudgeonMock = function() {
		 				return {
		 					run: function() {
		 						return when.resolve( true );
		 					}
		 				};
		 			};
		 			drudgeonMock.readSet = noop;
		 			var readSet = sinon.stub( drudgeonMock, "readSet" );

					packMock = sinon.mock( pack );
					var getInstalled = packMock.expects( "getInstalled" );
					var getDownloaded = packMock.expects( "getDownloaded" );
					var getInstallPath = packMock.expects( "getInstallPath" );

					getInstalled
						.withArgs( [] )
						.returns( when( {
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.0"
						} ) );

					getInstallPath
						.withArgs( "0.1.0" )
						.returns( versionPath );

					getDownloaded
						.withArgs( [] )
						.returns( when( undefined ) );

					getFile
						.withArgs( path.resolve( "./installs/test-me-master/0.1.0" ) )
						.returns( when( {
							boot: "./:node index.js",
							preboot: {
								"npm": "./:npm install"
							}
						} ) );

					fsMock.expects( "exists" )
						.withArgs( path.resolve( "./installs/test-me-master" ) )
						.returns( true );

					readSet
						.withArgs( { boot: "./:node index.js" } )
						.returns( {
							boot:
								{
									command: "node",
									arguments: [ "index.js" ],
									path: "./"
								}
							} );

					server.on( "started", function() {
						server.raise( "noConnection" );
					} );

					fsm = fsmFn( config, server, pack, processhost, drudgeonMock, bootFile, fs );
					var runningHandle, prebootedHandle;
					prebootedHandle = fsm.on( "preboot.completed", function() {
						prebooted = true;
						fsm.off( prebootedHandle );
					} );
					runningHandle = fsm.on( "running", function( runningInfo ) {
						info = runningInfo;
						fsm.off( runningHandle );
						lastState = fsm.state;
						done();
					} );

		 		} );

	 			it( "should run the preboot commands", function() {
	 				prebooted.should.be.true; // jshint ignore : line
	 			} );

				it( "should start the installed version", function() {
					fsm.installedVersion.should.equal( "0.1.0" );
				} );

				it( "should provide package info on event", function() {
					info.should.eql(
						{
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.0"
						}
					);
				} );

				it( "should end in running state", function() {
					lastState.should.equal( "running" );
				} );

				after( function() {
					fsMock.restore();
					bootFileMock.restore();
		 			packMock.restore();
		 			server.clear();
		 		} );
	 		} );

			describe( "with latest version downloaded not installed", function() {
	 			var lastState, prebooted, info;
	 			var bootFileMock, drudgeonMock;

		 		before( function( done ) {
		 			var versionPath = path.resolve( "./installs/test-me-master" );
		 			fsMock = sinon.mock( fs );
		 			bootFileMock = sinon.mock( bootFile );
		 			var getFile = bootFileMock.expects( "get" );

		 			drudgeonMock = function() {
		 				return {
		 					run: function() {
		 						return when.resolve( true );
		 					}
		 				};
		 			};
		 			drudgeonMock.readSet = noop;
		 			var readSet = sinon.stub( drudgeonMock, "readSet" );

					packMock = sinon.mock( pack );
					var getInstalled = packMock.expects( "getInstalled" );
					var getDownloaded = packMock.expects( "getDownloaded" );
					var getInstallPath = packMock.expects( "getInstallPath" );

					getInstalled
						.withArgs( [] )
						.returns( when( {
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.0"
						} ) );

					getInstallPath
						.withArgs( "0.1.0" )
						.returns( versionPath );

					getDownloaded
						.withArgs( [] )
						.resolves( {
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.1"
						} );

					getFile
						.withArgs( path.resolve( "./installs/test-me-master/0.1.1" ) )
						.returns( when( {
							boot: "./:node index.js",
							preboot: {
								"npm": "./:npm install"
							}
						} ) );

					fsMock.expects( "exists" )
						.withArgs( path.resolve( "./installs/test-me-master" ) )
						.onCall( 0 ).returns( true )
						.onCall( 1 ).returns( false );

					readSet
						.withArgs( { boot: "./:node index.js" } )
						.returns( {
							boot:
								{
									command: "node",
									arguments: [ "index.js" ],
									path: "./"
								}
							} );

					server.on( "started", function() {
						server.raise( "noConnection" );
					} );

					fsm = fsmFn( config, server, pack, processhost, drudgeonMock, bootFile, fs );
					var runningHandle, prebootedHandle;
					prebootedHandle = fsm.on( "preboot.completed", function() {
						prebooted = true;
						fsm.off( prebootedHandle );
					} );
					runningHandle = fsm.on( "running", function( runningInfo ) {
						info = runningInfo;
						fsm.off( runningHandle );
						lastState = fsm.state;
						done();
					} );

		 		} );

	 			it( "should run the preboot commands", function() {
	 				prebooted.should.be.true; // jshint ignore : line
	 			} );

				it( "should start the installed version", function() {
					fsm.installedVersion.should.equal( "0.1.1" );
				} );

				it( "should provide package info on event", function() {
					info.should.eql(
						{
							owner: "me",
							project: "test",
							branch: "master",
							version: "0.1.1"
						}
					);
				} );

				it( "should end in running state", function() {
					lastState.should.equal( "running" );
				} );

				after( function() {
					fsMock.restore();
					bootFileMock.restore();
		 			packMock.restore();
		 			server.clear();
		 		} );
	 		} );
		} );

		describe( "with connectivity", function() {

			describe( "with newest local package", function() {

				it( "should run the preboot commands" );

				it( "should start installed version" );

				after( function() {
		 			packMock.restore();
		 			server.clear();
		 		} );
			} );

			describe( "with old local package", function() {

				it( "should stop the running version (if any)" );

				it( "should run the preboot commands" );

				it( "should start the new version" );

				after( function() {
		 			packMock.restore();
		 			server.clear();
		 		} );
			} );

		} );
	} );
} );
