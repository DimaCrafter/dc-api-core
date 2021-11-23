const ROOT = process.cwd();
let controllers = {};

module.exports = {
	/**
	 * @param {string} name Controller name without extension
	 * @returns {object} Cached controller instance
	 */
	getController (name) {
		if (controllers && name in controllers) {
			return controllers[name];
		}

		return module.exports.registerController(name, require(ROOT + '/controllers/' + name + '.js'));
	},
	registerController (name, ControllerClass) {
		if (typeof ControllerClass != 'function') {
			throw new Error(`Exported value from ${name} controller isn't a class`);
		}

		const controller = new ControllerClass();
		controller._name = name;

		controllers[name] = controller;
		return controller;
	},
	getActionCaller (controller, actionFn) {
		return async ctx => {
			if (controller.onLoad) {
				await controller.onLoad.call(ctx);
				if (ctx._res.aborted) return;
			}

			ctx.controller = controller;
			return await actionFn.call(ctx);
		};
	},
	dispose () {
		controllers = undefined;
	}
};
