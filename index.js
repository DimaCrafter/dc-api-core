const uWS = require('uWebSockets.js');
const { readdirSync, existsSync } = require('fs');
const config = require('./config');
const log = require('./log');

const ROOT = process.cwd();
const app = (() => {
	if (config.ssl) {
		const opts = { ...config.ssl };
		opts.cert_file_name = opts.cert_file_name || opts.cert;
		opts.key_file_name = opts.key_file_name || opts.key;
		return uWS.SSLApp(opts);
	} else {
		return uWS.App();
	}
})();


const { camelToKebab } = require('./utils');
const Router = require('./router');
const { getController, executeStartup } = require('./utils/loader');
const { prepareHttpConnection, fetchBody, abortRequest } = require('./utils/http');
const CORS = require('./utils/cors');

const { SocketController, registerSocketController } = require('./contexts/websocket');
exports.SocketController = SocketController;
const { HttpController, registerHttpController, dispatchHttp } = require('./contexts/http');
exports.HttpController = HttpController;

executeStartup().then(() => {
	// CORS preflight request
	app.options('/*', (res, req) => {
		CORS.preflight(req, res);
		res.writeStatus('200 OK');
		res.end();
	});

	let controllersDirContents;
	if (existsSync(ROOT + '/controllers')) {
		controllersDirContents = readdirSync(ROOT + '/controllers');
	} else {
		controllersDirContents = [];
		log.warn('No "controllers" directory');
	}

	// Preloading controllers
	for (let controllerName of controllersDirContents) {
		try {
			if (controllerName.endsWith('.js')) {
				controllerName = controllerName.slice(0, -3);
				const controller = getController(controllerName);

				if (controller instanceof SocketController) {
					registerSocketController(app, '/' + camelToKebab(controllerName), controller);
				} else {
					registerHttpController(app, '/' + (config.supportOldCase ? controllerName : camelToKebab(controllerName)), controller);
				}
			}
		} catch (err) {
			log.error(`Loading "${controllerName}" controller failed`, err);
			process.exit(-1);
		}
	}

	// TODO: do smth with custom routes
	app.any('/*', async (res, req) => {
		prepareHttpConnection(req, res);
		const route = Router.match(req.path);
		if (!route) {
			return abortRequest(res, 404, 'API endpoint not found');
		}

		if (req.getMethod() == 'post') await fetchBody(req, res);
		if (res.aborted) return;

		await dispatchHttp(req, res, ctx => {
			ctx.params = route.params;
			return route.target(ctx);
		});
	});

	// Backward compatibility for Socket controller, will be removed soon
	try {
		const controller = getController('Socket');
		if (!(controller instanceof SocketController)) {
			registerSocketController(app, '/socket', controller);
			log.warn('Deprecated usage of "Socket" controller without extending `SocketController`');
		}
	} catch (err) {
		if (!err.message.includes('Cannot find module')) {
			log.error('Loading "Socket" controller failed', err);
			process.exit(-1);
		}
	}

	// Listening port
	app.listen(config.port, socket => {
		const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
		if (socket) log.success('Server started ' + status);
		else log.error('Can`t start server ' + status);
	});
});
