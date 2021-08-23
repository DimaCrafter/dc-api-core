const uWS = require('uWebSockets.js');
const config = require('./config');
const log = require('./log');

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

const ROOT = process.cwd();
const fs = require('fs');
const { camelToKebab } = require('./utils/case-convert');
const Router = require('./router');
const { getController } = require('./utils/loader');
const { prepareHttpConnection, fetchBody, abortRequest } = require('./utils/http');
const CORS = require('./utils/cors');

const { SocketController, registerSocketController } = require('./contexts/websocket');
exports.SocketController = SocketController;
const { HttpController, registerHttpController, dispatchHttp } = require('./contexts/http');
exports.HttpController = HttpController;

(async () => {
	// Waiting startup.js
	if (fs.existsSync(ROOT + '/startup.js')) {
		log.info('Running startup script')
		let startup = require(ROOT + '/startup.js');
		if (typeof startup == 'function') startup = startup.apply({});
		if (startup instanceof Promise) await startup;
	}

	// CORS preflight request
	app.options('/*', (res, req) => {
		CORS.preflight(req, res);
		res.writeStatus('200 OK');
		res.end();
	});

	// Preloading controllers
	for (let controllerName of fs.readdirSync(ROOT + '/controllers')) {
		if (controllerName.endsWith('.js')) {
			controllerName = controllerName.slice(0, -3);
			const controller = getController(controllerName);

			if (controller instanceof SocketController) {
				registerSocketController(app, '/' + camelToKebab(controllerName), controller);
			} else {
				registerHttpController(app, '/' + (config.supportOldCase ? controllerName : camelToKebab(controllerName)), controller);
			}
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
			log.warn('Deprecated usage of `Socket` controller without extending `SocketController`');
		}
	} catch {}

	// Listening port
	app.listen(config.port, socket => {
		const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
		if (socket) log.success('Server started ' + status);
		else log.error('Can`t start server ' + status);
	});
})();
