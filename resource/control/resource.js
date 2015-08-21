var _ = require( "lodash" );
var postal = require( "postal" );
var notifications = postal.channel( "notifications" );

var lookup = {
	platform: "package",
	architecture: "package",
	osVersion: "package",
	osName: "package",
	project: "package",
	owner: "package",
	branch: "package",
	build: "package",
	version: "package",
	releasOnly: "package",
	failures: "service",
	tolerance: "service"
};

var validCommands = [ "start", "stop", "reset" ];

function operate( state, op, field, value ) {
	switch( op ) {
		case "change":
			state[ field ] = value;
			break;
		case "remove":
			state[ field ] = undefined;
			break;
	}
}

module.exports = function( host, control, packages, config ) {
	return {
		name: "control",
		actions: {
			configure: {
				url: "/",
				method: "patch",
				handle: function( envelope ) {
					notifications.publish( "configuration.changed", {
						original: config,
						changes: envelope.data
					} );
					_.each( envelope.data, function( op ) {
						var section = config[ lookup[ op.field ] ];
						if( section ) {
							operate( section, op.op, op.field, op.value );
							config[ lookup[ op.field ] ] = section;
							if( section === "package" ) {
								if( config.filter[ op.field ] ) {
									config.filter[ op.field ]( op.value );
								}
							}
						}
					} );
					packages.updateConfig( config );
					control.reset( config );
					return {
						data: {
							index: config.index,
							package: config.filter.toHash()
						}
					};
				}
			},
			command: {
				url: "/",
				method: "put",
				handle: function( envelope ) {
					var command = envelope.data.command;
					if( _.contains( validCommands, command ) ) {
						notifications.publish( "control.command", {
							command: command
						} );
						control[ command ]();
						return {
							status: 202,
							data: {
								message: "Processing command - " + command
							}
						};
					}
					return {
						status: 400,
						data: {
							message: "Invalid command - " + command
						}
					};
				}
			}
		}
	};
};
