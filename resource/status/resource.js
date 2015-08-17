module.exports = function( host, config, status ) {
	return {
		name: "status",
		actions: {
			service: {
				url: "/",
				method: "get",
				handle: function( envelope ) {
					return {
						data: {
							uptime: {
								host: status.uptime,
								service: status.serviceUptime
							},
							package: config.filter.toHash(),
							version: status.currentVersion,
							state: status.state,
							index: config.index,
							port: config.service.port.public,
							host: config.service.host,
							name: config.service.name
						}
					};
				}
			}
		}
	};
};
