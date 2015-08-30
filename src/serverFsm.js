var path = require( "path" );
var debug = require( "debug" )( "nonstop:index-client" );
var machina = require( "machina" );

function createFsm( config, packages, installed ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		_setup: function() {
			this.installedVersion = installed || "0.0.0";
			if( this.installedVersion !== "0.0.0" ) {
				this.installed = packages.getInstalledInfo( this.installedVersion );
			}
			this.ignored = [];
			this.wait = 5000;
			if( config && config.index && config.index.frequency ) {
				this.wait = config.index.frequency;
			}
			this.waitCeiling = this.wait * 10;
			this.lastWait = 0;
		},

		checkForNew: function() {
			this.timeout = null;
			this.transition( "checkingForNew" );
		},

		ignore: function( version ) {
			this.ignored.push( version );
		},

		initialize: function() {
			this._setup();
		},

		install: function( info ) {
			this.downloaded = info;
			debug( "Installing downloaded package \"%s\"", info.file );
			this.emit( "downloaded", info );
			this.transition( "installing" );
		},

		reset: function( newConfig ) {
			if( this.timeout ) {
				clearTimeout( this.timeout );
			}
			if( newConfig ) {
				config = newConfig;
			}
			this._setup();
			this.transition( "checkingForNew" );
		},

		start: function( version ) {
			if( version ) {
				this.installedVersion = version;
			}
			this.transition( "checkingForNew" );
		},

		stop: function() {
			if( this.timeout ) {
				clearTimeout( this.timeout );
			}
			this.transition( "stopped" );
		},

		initialState: "initializing",
		states: {
			initializing: {

			},
			checkingForNew: {
				_onEnter: function() {
					packages.getAvailable( this.ignored )
						.then(
							this._raise( "available.done" ),
							this._raise( "available.failed" )
						);
				},
				"available.done": function( latest ) {
					if( latest ) {
						if( packages.hasLatest( this.installedVersion, latest.version ) ) {
							this.transition( "waiting" );
							this.emit( "hasLatest", latest );
						} else {
							this.downloading = latest;
							this.emit( "hasNew", latest );
							this.transition( "downloading" );
						}
					} else {
						debug( "No package versions matched the following filter \"%s\"", JSON.stringify( config.filter.toHash() ) );
						this.transition( "waiting" );
					}
				},
				"available.failed": function( err ) {
					this.emit( "noConnection" );
					debug( "Failed to check for new versions: %s", err.message );
					this.transition( "failed" );
				}
			},
			downloading: {
				_onEnter: function() {
					this.emit( "downloading", this.downloading );
					packages.download( this.downloading.file )
						.then( this._raise( "download.done" ) );
				},
				"download.done": function( info ) {
					this.downloaded = info;
					debug( "Downloaded package \"%s\" successfully", info.file );
					this.emit( "downloaded", info );
					this.transition( "installing" );
				},
				"download.failed": function( err ) {
					debug( "Download for version %\"%s\" failed with %s", this.latest.version, err.stack ? err.stack : err );
					this.emit( "download.failed", this.downloaded );
					this.transition( "failed" );
				}
			},
			installing: {
				_onEnter: function() {
					this.emit( "installing", this.downloaded );
					var downloaded = path.resolve( config.downloads, this.downloaded.file );
					packages.install( downloaded )
						.then( this._raise( "installation.done" ) )
						.then( null, this._raise( "installation.failed" ) );
				},
				"installation.done": function() {
					this.latest = this.downloaded;
					this.installedVersion = this.latest.version;
					debug( "Installation of version \"%s\" completed successfully", this.installedVersion );
					this.emit( "installed", this.latest );
					this.transition( "waiting" );
				},
				"installation.failed": function( err ) {
					debug( "Installation of version \"%s\" failed with %s", this.latest.version, err.stack ? err.stack : err );
					this.emit( "install.failed", this.downloaded );
					this.transition( "failed" );
				}
			},
			waiting: {
				_onEnter: function() {
					if( this.timeout ) {
						return;
					}
					var wait = this.wait;
					debug( "Checking index for updates in %d ms", wait );
					this.timeout = setTimeout( this.checkForNew.bind( this ), wait );
				}
			},
			failed: {
				_onEnter: function() {
					if( this.timeout ) {
						return;
					}
					var wait = this.lastWait + this.wait;
					this.lastWait = wait;
					if( wait > this.waitCeiling ) {
						wait = this.waitCeiling;
					}
					debug( "Attempting reconnection in", wait, "ms" );
					this.emit( "waiting", { state: "retrying connection in " + wait + " ms" } );
					this.timeout = setTimeout( this.checkForNew.bind( this ), wait );
				}
			},
			stopped: {
				_onEnter: function() {

				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;
