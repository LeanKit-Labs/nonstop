var _ = require( 'lodash' );

var keys = [
	'project',
	'owner',
	'branch',
	'build',
	'version',
	'osVersion',
	'osName',
	'architecture',
	'platform'
];

function createFilter( cfg ) {
	var props = {};
	_.each( keys, function( k ) {
		props[ k ] = function( v ) {
			props[ k ]._val = v;
			return props;
		};
		props[ k ].toString = function() { return props[ k ]._val; };
	} );
	_.each( cfg, function( v, k ) {
		if( v && props[ k ] ) {
			props[ k ]( v );
		}
	} );
	props.toHash = function() {
		return _.reduce( keys, function( acc, k ) {
			var val = props[ k ]._val;
			if( val ) {
				acc[ k ] = val;
			}
			return acc;
		}, {} );
	};
	props.toString = function() {
		var str = _.filter( _.map( keys, function( k ) {
			var v = props[ k ]._val;
			if( v ) {
				return [ k, v ].join( '=' );	
			}			
		} ) ).join( '&' );
		return str;
	};
	return props;
}

module.exports = createFilter;