var path = require( 'path' );
var debug = require( 'debug' )( 'nonstop:index-client' );
var machina = require( 'machina' );

function createFsm( config, packages, installed ) {
	var Machine = machina.Fsm.extend( {

		_raise: function( ev ) {
			return function( result ) {
				this.handle( ev, result );
			}.bind( this );
		},

		ignore: function( version ) {
			this.ignored.push( version );
		},

		initialize: function() {
			this.installedVersion = installed || '0.0.0';
			this.ignored = [];
			this.wait = 5000;
			if( config && config.index && config.index.frequency ) {
				this.wait = config.index.frequency;
			}
			this.waitCeiling = this.wait * 10;
			this.lastWait = 0;
		},

		start: function( version ) {
			if( version ) {
				this.installedVersion = version;
			}
			this.transition( 'checkingForNew' );
		},

		stop: function() {
			this.transition( 'stopped' );
		},

		initialState: 'initializing',
		states: {
			initializing: {

			},
			checkingForNew: {
				_onEnter: function() {
					packages.getAvailable( this.ignored )
						.then( this._raise( 'available.done' ) )
						.then( null, this._raise( 'available.failed' ) );
				},
				'available.done': function( latest ) {
					this.latest = latest;
					if( latest ) {
						if( packages.hasLatest( this.installedVersion, latest.version ) ) {
							this.transition( 'waiting' );
							this.emit( 'hasLatest', this.installedVersion );
						} else {
							this.emit( 'hasNew' );
							this.transition( 'downloading' );
						}
					} else {
						debug( 'No package versions matched the following filter \'%s\'', JSON.stringify( config.filter.toHash() ) );
						this.transition( 'waiting' );
					}
				},
				'available.failed': function( err ) {
					this.emit( 'noConnection' );
					debug( 'Failed to check for new versions: %s', err.toString().replace( 'Error: ', '' ) );
					this.transition( 'waiting' );
				}
			},
			downloading: {
				_onEnter: function() {
					packages.download( this.latest.file )
						.then( this._raise( 'download.done' ) );
				},
				'download.done': function( info ) {
					this.downloaded = info;
					debug( 'Downloaded package \'%s\' successfully', info.file );
					this.emit( 'downloaded', info );
					this.transition( 'installing' );
				}
			},
			installing: {
				_onEnter: function() {
					var downloaded = path.resolve( config.downloads, this.downloaded.file );
					packages.install( downloaded )
						.then( this._raise( 'installation.done' ) )
						.then( null, this._raise( 'installation.failed' ) );
				},
				'installation.done': function() {
					debug( 'Installation of version \'%s\' completed successfully', this.latest.version );
					this.installedVersion = this.latest.version;
					this.transition( 'waiting' );
					this.emit( 'installed', this.installedVersion, this.projectPath );
				},
				'installation.failed': function( err ) {
					debug( 'Installation of version \'%s\' failed with %s', this.latest.version, err.stack );
					this.transition( 'waiting' );
				}
			},
			waiting: {
				_onEnter: function() {
					var wait = this.lastWait + this.wait;
					this.lastWait = wait;
					if( wait > this.waitCeiling ) {
						wait = this.waitCeiling;
					}
					this.timeout = setTimeout( function() {
						this.handle( 'timeout' );
					}.bind( this ), wait );
				},
				timeout: function() {
					this.transition( 'checkingForNew' );
				}
			},
			stopped: {
				_onEnter: function() {
					if( this.timeout ) {
						clearTimeout( this.timeout );
					}
				}
			}
		}
	} );

	return new Machine();
}

module.exports = createFsm;