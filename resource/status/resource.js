module.exports = function( host, config, status ) {
	return {
		name: "status",
		actions: {
			service: {
				url: "/",
				method: "get",
				handle: function() {
					return {
						data: {
							uptime: {
								host: status.uptime,
								service: status.serviceUptime
							},
							version: status.currentVersion,
							state: status.state,
							port: config.service.port.public,
							host: config.service.host,
							name: config.service.name,
							installed: status.latestInstall || "N/A",
							package: config.filter.toHash(),
							index: config.index
						}
					};
				}
			}
		}
	};
};
