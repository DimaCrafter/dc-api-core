const { existsSync } = require('fs');
const Path = require('path');
const log = require('../log');
const config = require('../config');

const ROOT = process.cwd();

const controllers = {};
/**
 * @param {string} name Controller name without extension
 * @returns {object} Cached controller instance
 */
exports.getController = name => {
	if (controllers && name in controllers) {
		return controllers[name];
	}

	let path = Path.join(ROOT, 'controllers', name + '.js');
	let exists = existsSync(path);

	if (!exists && config.typescript) {
		path = Path.join(ROOT, 'controllers', name + '.ts');
		exists = existsSync(path);
	}

	if (!exists) {
		throw `Controller "${name}" at "${Path.dirname(path)}" not found`;
	}

	return module.exports.registerController(name, require(path));
}

exports.registerController = (name, ControllerClass) => {
	if (typeof ControllerClass === 'object') {
		if (ControllerClass.default) {
			// export default class ...
			ControllerClass = ControllerClass.default;
		} else if (name in ControllerClass) {
			// export class ...
			ControllerClass = ControllerClass[name];
		}
	}

	// module.exports = class ...
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

function* iterPlugins () {
	if (!config.plugins) return;

	for (const plugin of config.plugins) {
		if (plugin.startsWith('local:')) {
			yield { plugin, path: require.resolve(Path.join(ROOT, plugin.slice(6))) };
		} else {
			yield { plugin, path: require.resolve(plugin) };
		}
	}
}

let onPluginsLoaded;
exports.pluginLoadEnd = new Promise(resolve => onPluginsLoaded = resolve);

exports.loadPlugins = () => {
	for (const { plugin, path } of iterPlugins()) {
		try {
			require(path);
			log.success(`Plugin "${plugin}" loaded`);
		} catch (error) {
			log.error(`Cannot load plugin "${plugin}"`, error);
			process.exit(-1);
		}
	}

	onPluginsLoaded();
}

exports.findPluginDirectory = mainEntry => {
	for (const { path } of iterPlugins()) {
		if (require(path) == mainEntry) {
			return Path.dirname(path);
		}
	}
}

exports.executeStartup = async () => {
	let path = Path.join(ROOT, 'startup.js');
	let exists = existsSync(path);

	if (!exists && config.typescript) {
		path = Path.join(ROOT, 'startup.ts');
		exists = existsSync(path);
	}

	if (!exists) {
		return;
	}

	log.info('Running startup script');
	try {
		let startup = require(path);
		if (typeof startup == 'function') {
			startup = startup();
		}

		if (startup instanceof Promise) {
			await startup;
		}
	} catch (error) {
		log.error('Startup script error', error);
		process.exit(-1);
	}
}
