const { existsSync } = require('fs');
const Path = require('path');
const log = require('../log');
const config = require('../config');

const ROOT = process.cwd();
const STARTUP_PATH = Path.join(ROOT, 'startup.js');

const controllers = {};
/**
 * @param {string} name Controller name without extension
 * @returns {object} Cached controller instance
 */
exports.getController = name => {
	if (controllers && name in controllers) {
		return controllers[name];
	}

	return module.exports.registerController(name, require(Path.join(ROOT, 'controllers', name + '.js')));
}

exports.registerController = (name, ControllerClass) => {
	if (typeof ControllerClass != 'function') {
		throw new Error(`Exported value from ${name} controller isn't a class`);
	}

	const controller = new ControllerClass();
	controller._name = name;

	controllers[name] = controller;
	return controller;
}

exports.getActionCaller = (controller, actionFn) => {
	return async ctx => {
		if (controller.onLoad) {
			await controller.onLoad.call(ctx);
			if (ctx._res.aborted) return;
		}

		ctx.controller = controller;
		return await actionFn.call(ctx);
	};
}

exports.executeStartup = async () => {
	if (config.plugins) {
		for (const plugin of config.plugins) {
			try {
				if (plugin.startsWith('local:')) {
					require(Path.join(ROOT, plugin.slice(6)));
				} else {
					require(plugin);
				}
			} catch (err) {
				log.error(`Cannot load plugin "${plugin}"`, err);
				process.exit(-1);
			}
		}
	}

	if (existsSync(STARTUP_PATH)) {
		log.info('Running startup script');
		try {
			let startup = require(STARTUP_PATH);
			if (typeof startup == 'function') {
				startup = startup();
			}

			if (startup instanceof Promise) {
				await startup;
			}
		} catch (err) {
			log.error('Startup script error', err);
			process.exit(-1);
		}
	}
}
