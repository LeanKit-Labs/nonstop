var _ = require( "lodash" );
var indexClient = require( "nonstop-index-client" );

function getClient( config ) {
	return indexClient(  {
		index: config.index,
		package: config.package
	} );
}

function updateConfig( config ) {
	this.config = config;
	this.client = getClient( config );
}

module.exports = function( config ) {
	var state = {
		config: config,
		client: getClient( config ),
		update: updateConfig.bind( this )
	};
	return state;
};
