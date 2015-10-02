var _ = require( "lodash" );
var moment = require( "moment" );
var postal = require( "postal" );
require( "moment-duration-format" );

var channel = postal.channel( "status" );
var started = moment();
var serviceStart;
var format = "d [days] h [hours] m [minutes] s [seconds]";
var status = {
	currentVersion: "N/A",
	state: "N/A"
};

channel.subscribe( "started", function( info ) {
	if( info ) {
		serviceStart = moment();
		status.currentVersion = info.version;
	}
} );

channel.subscribe( "stopped", function() {
	serviceStart = undefined;
} );

channel.subscribe( "state", function( info ) {
	_.merge( status, info );
} );

function getUptime() {
	return moment
		.duration( moment() - started )
		.format( format );
}

function getServiceUptime() {
	return moment
		.duration( moment() - ( serviceStart || moment() ) )
		.format( format );
}

Object.defineProperty( status, "uptime", {
	get: getUptime
} );

Object.defineProperty( status, "serviceUptime", {
	get: getServiceUptime
} );

module.exports = status;
