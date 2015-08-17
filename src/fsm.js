var path = require( "path" );
var debug = require( "debug" )( "nonstop:bootstrapper" );
var machina = require( "machina" );
var postal = require( "postal" );
var channel = postal.channel( "status" );

function createFsm( config, server, packages, processhost, drudgeon, bootFile, fs ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		initialize: function() {
			this.ignored = [];
			processhost.on( "hosted.started", function() {
				this.transition( "running" );
			}.bind( this ) );
			processhost.on( "hosted.failed", function( err ) {
				channel.publish( "state", { state: "rolling back" } );
				this.handle( "process.failed", err );
			}.bind( this ) );
			server.on( "noConnection", function() {
				channel.publish( "state", { state: "waiting to connect" } );
				this.handle( "noConnection" );
			}.bind( this ) );
			server.on( "hasLatest", function( version ) {
				this.installedVersion = version;
				this.handle( "hasLatest" );
			}.bind( this ) );
			server.on( "downloading", function( file ) {
				channel.publish( "state", { state: "downloading " + file } );
			}.bind( this ) );
			server.on( "installing", function( file ) {
				channel.publish( "state", { state: "installing " + file } );
			}.bind( this ) );
			server.on( "installed", function( version ) {
				this.installedVersion = version;
				this.handle( "installed" );
			}.bind( this ) );
			server.on( "waiting", function( info ) {
				channel.publish( "state", info );
			}.bind( this ) );
			this.setProjectPath();
			this.on( "transition", function( transition ) {
				channel.publish( "state", { state: transition.toState } );
			} );
		},

		setProjectPath: function() {
			var filter = config.filter.toHash();
			this.installed = path.resolve( "./installs", [ filter.project, filter.owner, filter.branch ].join( "-" ) );
		},

		reset: function() {
			debug( "Resetting bootstrapper" );
			server.reset();
			this.transition( "initializing" );
		},

		start: function() {
			debug( "Starting bootstrapper" );
			server.start();
			this.transition( "initializing" );
		},

		stop: function() {
			debug( "Stopping bootstrapper" );
			server.stop();
			this.transition( "stopped" );
		},

		initialState: "initializing",
		states: {
			initializing:{
				_onEnter: function() {
					packages.getInstalled( this.ignored )
						.then( this._raise( "installed.done" ) );
				},
				"installed.done": function( installed ) {
					this.installedVersion = installed || "0.0.0";
					packages.getDownloaded( this.ignored )
						.then( this._raise( "downloaded.done" ) );
				},
				"downloaded.done": function( downloaded ) {
					this.downloadedVersion = downloaded || "0.0.0";
					debug( "Initializing - latest install \"%s\" : lastest download \"%s\"", this.installedVersion, this.downloadedVersion );
					server.start( this.installedVersion );
				},
				hasLatest: function() {
					this.transition( "loading" );
				},
				installed: function() {
					this.transition( "loading" );
				},
				noConnection: function() {
					this.transition( "loading" );
				}
			},
			loading: {
				_onEnter: function() {
					if( fs.exists( this.installed ) ) {
						var bootPath = path.resolve( this.installed, this.installedVersion );
						bootFile.get( bootPath )
							.then( function( file ) {
								processhost.stop();
								this.bootFile = file;
								if( file.preboot ) {
									this.transition( "prebooting" );
								} else {
									this.transition( "starting" );
								}
							}.bind( this ) );

					} else {
						debug( "No installed version available." );
						this.transition( "waiting" );
					}
				}
			},
			prebooting: {
				_onEnter: function() {
					if( this.bootFile.preboot ) {
						drudgeon( config.package.platform, this.bootFile.preboot, this.installed ) // jshint ignore:line
							.then( this._raise( "preboot.done" ) )
							.then( this._raise( "preboot.failed" ) );
					} else {
						this.transition( "starting" );
					}
				},
				"preboot.done": function() {
					this.emit( "preboot.completed" );
					this.transition( "starting" );
				},
				"preboot.failed": function( err ) {
					this.ignored.push( this.installedVersion );
					server.ignore( this.installedVersion );
					debug( "Preboot for version \"%s\" failed with %s", this.installedVersion, err );
				}
			},
			starting: {
				_onEnter: function() {
					var set = drudgeon.readSet( { boot: this.bootFile.boot } );
					var process = {
						command: set.boot.command,
						args: set.boot.arguments,
						cwd: path.resolve( this.installed, this.installedVersion, set.boot.path ),
						stdio: "inherit",
						restartLimit: 1,
						restartWindow: 5000
					};
					processhost.create( "hosted", process );
					processhost.start( "hosted");
				},
				installed: function() {
					this.deferUntilTransition( "running" );
				},
				"process.failed": function( err ) {
					debug( "Service version \`%s\` failed beyond set tolerance", this.installedVersion );
					this.ignored.push( this.installedVersion );
					server.ignore( this.installedVersion );
					this.transition( "initializing" );
				}
			},
			running: {
				_onEnter: function() {
					debug( "Service version \"%s\" started", this.installedVersion );
					this.emit( "running" );
					channel.publish( "started", { version: this.installedVersion } );
				},
				installed: function() {
					debug( "New version \"%s\" installed", this.installedVersion );
					this.transition( "loading" );
				},
				"process.failed": function( err ) {
					debug( "Service version \`%s\` failed beyond set tolerance", this.installedVersion );
					channel.publish( "stopped", { version: this.installedVersion } );
					this.ignored.push( this.installedVersion );
					server.ignore( this.installedVersion );
					this.transition( "initializing" );
				}
			},
			stopped: {
				_onEnter: function() {
					clearTimeout( this.timeout );
					channel.publish( "stopped", { version: this.installedVersion } );
				}
			},
			waiting: {
				_onEnter: function() {
					this.emit( "waiting" );
				},
				hasLatest: function() {
					this.transition( "loading" );
				},
				installed: function() {
					this.transition( "loading" );
				},
				noConnection: function() {
					this.transition( "loading" );
				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;
