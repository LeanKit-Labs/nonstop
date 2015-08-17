var _ = require( "lodash" );

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
	releasOnly: "package"
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
					_.each( envelope.data, function( op ) {
						var section = config[ lookup[ op.field ] ];
						if( section ) {
							operate( section, op.op, op.field, op.value );
							config[ lookup[ op.field ] ] = section;
							if( config.filter[ op.field ] ) {
								config.filter[ op.field ]( op.value );
							}
						}
					} );
					packages.updateConfig( config );
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
