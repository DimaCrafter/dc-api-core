module.exports = {
	routes: [],
	register (pattern, target) {
		const params = [];
		pattern = pattern.replace(/\${([a-zA-z0-9_]+)}/g, (_, param) => {
			params.push(param);
			return '(.*?)';
		});

		if (typeof target == 'string') {
			target = target.split('.');
		}

		const route = { target };
		if (params.length) {
			route.pattern = new RegExp('^' + pattern + '$');
			route.params = params;
		} else {
			route.pattern = pattern;
			route.isText = true;
		}

		this.routes.push(route);
		return route;
	},

	match (path) {
		for (const route of this.routes) {
			if (route.isText) {
				if (route.pattern == path) return { target: route.target };
				else continue;
			} else {
				let matched = route.pattern.exec(path);
				if (matched) {
					let params = {};
					for (let i = 0; i < route.params.length; i++) {
						params[route.params[i]] = matched[i + 1];
					}

					return { target: route.target, params };
				} else {
					continue;
				}
			}
		}
	}
};
