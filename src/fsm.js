var _ = require( "lodash" );
var path = require( "path" );
var debug = require( "debug" )( "nonstop:bootstrapper" );
var machina = require( "machina" );
var postal = require( "postal" );
var channel = postal.channel( "status" );
var notifications = postal.channel( "notifications" );
var semver = require( "semver" );

function createFsm( config, server, packages, processhost, drudgeon, bootFile, fs ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		_reset: function() {
			this.old = this.latestInstall || this.latestDownload;
			this.bootFile = undefined;
			this.installed = undefined;
			this.installedInfo = undefined;
			this.installedVersion = undefined;
			this.downloadedVersion = undefined;
			this.latestInstall = undefined;
			this.latestDownload = undefined;
			this.setProjectPath();
		},

		bootService: function( file ) {
			processhost.stop();
			this.bootFile = file;
			if( file.preboot ) {
				this.transition( "prebooting" );
			} else {
				this.transition( "starting" );
			}
		},

		getInfo: function() {
			return this.latestInstall || this.latestDownload || this.old;
		},

		hasNewestInstalled: function() {
			return semver.gte( this.installedVersion, this.downloadedVersion );
		},

		hasValidDownload: function() {
			var package = config.package;
			var version;
			if( package.version ) {
				version = _.filter( [ package.version, package.build ] ).join( "-" );
			}
			if( !_.isEmpty( version ) ) {
				return _.contains( this.downloadedVersion, version );
			} else {
				return this.downloadedVersion;
			}
			return false;
		},

		hasValidInstall: function() {
			var package = config.package;
			var version;
			if( package.version ) {
				version = _.filter( [ package.version, package.build ] ).join( "-" );
			}
			if( !_.isEmpty( version ) ) {
				return _.contains( this.installedVersion, version );
			} else {
				return this.installedVersion;
			}
			return false;
		},

		initialize: function() {
			this.ignored = [];
			processhost.on( "hosted.started", function() {
				notifications.publish( "service.started", this.getInfo() );
				this.sendState( "running" );
				this.transition( "running" );
			}.bind( this ) );

			processhost.on( "hosted.crashed", function() {
				var msg = _.defaults( {}, this.getInfo() );
				notifications.publish( "service.crashed", msg );
			}.bind( this ) );

			processhost.on( "hosted.failed", function() {
				var msg = _.defaults( {}, this.getInfo() );
				notifications.publish( "service.failed", msg );
				channel.publish( "stopped", { version: this.installedVersion } );
				this.sendState( "failed" );
				this.handle( "process.failed" );
			}.bind( this ) );

			server.on( "noConnection", function() {
				this.handle( "noConnection" );
			}.bind( this ) );

			server.on( "hasLatest", function( info ) {
				this.installedVersion = info.version;
				this.handle( "hasLatest" );
			}.bind( this ) );

			server.on( "downloading", function( info ) {
				notifications.publish( "host.downloading", info );
				this.sendState( "downloading " + info.file );
			}.bind( this ) );

			server.on( "installing", function( info ) {
				notifications.publish( "host.installing", info );
				this.sendState( "installing " + info.file );
			}.bind( this ) );

			server.on( "installed", function( info ) {
				this.installedVersion = info.version;
				this.handle( "installed", info );
			}.bind( this ) );

			this.setProjectPath();
		},

		onServiceFailure: function() {
			this.ignored.push( this.installedVersion );
			server.ignore( this.installedVersion );
			this._reset();
			this.transition( "initializing" );
		},

		reset: function( newConfig ) {
			this.ignored = [];
			if( newConfig ) {
				config = newConfig;
				this._reset();
				this.setProjectPath();
			}
			processhost.stop();
			debug( "Resetting service host" );
			server.reset();
			this.transition( "initializing" );
		},

		sendState: function( state ) {
			channel.publish( "state", {
				state: state,
				version: this.installedVersion,
				latestInstall: this.getInfo()
			} );
		},

		setProjectPath: function() {
			var filter = config.filter.toHash();
			this.installed = path.resolve( "./installs", [ filter.project, filter.owner, filter.branch ].join( "-" ) );
		},

		start: function() {
			debug( "Starting service host" );
			server.start();
			this.transition( "initializing" );
		},

		stop: function() {
			debug( "Stopping service host" );
			server.stop();
			processhost.stop();
			this.transition( "stopped" );
		},

		initialState: "initializing",
		states: {
			initializing:{
				_onEnter: function() {
					packages.getInstalled( this.ignored )
						.then(
							this._raise( "installed.done" ),
							this._raise( "installed.failed" )
						);
				},
				"installed.failed": function( err ) {
					debug( "Failed to locate any installs due to error %s", err.stack ? err.stack : err );
					server.start( "0.0.0" );
					this.transition( "waiting" );
				},
				"installed.done": function( installed ) {
					this.latestInstall = installed;
					this.installedVersion = installed ? installed.version : "0.0.0";
					packages.getDownloaded( this.ignored )
						.then(
							this._raise( "downloaded.done" ),
							this._raise( "downloaded.failed" )
						);
				},
				"downloaded.done": function( downloaded ) {
					this.latestDownload = downloaded;
					this.downloadedVersion = downloaded ? downloaded.version : "0.0.0";
					debug( "Initializing - latest install \"%s\" : lastest download \"%s\"", this.installedVersion, this.downloadedVersion );
					if( this.installedVersion === "0.0.0" && this.downloadedVersion === "0.0.0" ) {
						server.start( this.installedVersion );
						this.transition( "waiting" );
					} else if( this.installedVersion !== "0.0.0" && this.hasValidInstall() && this.hasNewestInstalled() ) {
						this.installedInfo = this.latestInstall;
						server.start( this.installedVersion );
						this.transition( "loading" );
					} else if( this.downloadedVersion !== "0.0.0" && this.hasValidDownload() ) {
						server.install( this.latestDownload );
						this.transition( "waiting" );
					} else {
						this.transition( "waiting" );
					}
				},
				hasLatest: function( latest ) {
					this.installedInfo = latest;
					this.installedVersion = latest.version;
					this.transition( "loading" );
				},
				installed: function( latest ) {
					this.installedInfo = latest;
					this.installedVersion = latest.version;
					this.setProjectPath();
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
							.then(
								this.bootService.bind( this ),
								function( err ) {
									debug( "Error trying to get boot file from \"%s\" with %s",
										bootPath,
										err.stack ? err.stack : err );
									this.onServiceFailure();
								}.bind( this )
							);

					} else {
						debug( "No installed version available." );
						this.transition( "waiting" );
					}
				}
			},
			prebooting: {
				_onEnter: function() {
					if( this.bootFile.preboot ) {
						var relativePath = path.resolve( this.installed, this.installedVersion );
						var prebootConfig = {
							platform: config.package.platform,
							relativePath: relativePath
						};
						drudgeon( this.bootFile.preboot, prebootConfig )
							.run() // jshint ignore:line
							.then(
								this._raise( "preboot.done" ),
								this._raise( "preboot.failed" )
							);
					} else {
						this.transition( "starting" );
					}
				},
				"preboot.done": function() {
					this.emit( "preboot.completed" );
					this.transition( "starting" );
				},
				"preboot.failed": function( err ) {
					debug( "Preboot for version \"%s\" failed with %s", this.installedVersion, err );
					this.onServiceFailure();
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
						restartLimit: config.service.failures,
						restartWindow: config.service.tolerance
					};
					processhost.create( "hosted", process );
					processhost.start( "hosted");
				},
				installed: function() {
					this.deferUntilTransition( "running" );
				},
				"process.failed": function( err ) {
					debug( "Service version \`%s\` failed beyond set tolerance", this.installedVersion );
					this.onServiceFailure();
				}
			},
			running: {
				_onEnter: function() {
					debug( "Service version \"%s\" started", this.installedVersion );
					this.emit( "running", this.installedInfo );
					channel.publish( "started", this.installedInfo );
					server.start( this.installedVersion );
				},
				installed: function( latest ) {
					debug( "New version \"%s\" installed", this.installedVersion );
					this.installedInfo = latest;
					this.installedVersion = latest.version;
					this.setProjectPath();
					this.transition( "loading" );
				},
				"process.failed": function( err ) {
					debug( "Service version \`%s\` failed beyond set tolerance", this.installedVersion );
					this.onServiceFailure();
				}
			},
			stopped: {
				_onEnter: function() {
					channel.publish( "stopped", { version: this.installedVersion } );
				}
			},
			waiting: {
				_onEnter: function() {
					this.emit( "waiting" );
					this.sendState( "waiting for valid package" );
					server.start( this.installedVersion );
				},
				hasLatest: function( latest ) {
					this.installedInfo = latest;
					this.installedVersion = latest.version;
					this.transition( "loading" );
				},
				installed: function( latest ) {
					this.installedInfo = latest;
					this.installedVersion = latest.version;
					this.setProjectPath();
					this.transition( "loading" );
				},
				noConnection: function() {

				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;
