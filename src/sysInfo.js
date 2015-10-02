var os = require( "os" );

function getInfo() {
	return {
		name: os.hostname(),
		os: os.type(),
		platform: os.platform(),
		arch: os.arch(),
		version: os.release()
	};
}

module.exports = getInfo;