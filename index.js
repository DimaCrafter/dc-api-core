const uWS = require('uWebSockets.js');
require('./plugins').init();

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

const errorHandlers = [];
function emitError (info) {
	for (const handler of errorHandlers) {
		handler(info);
	}
}

class HttpError {
    constructor (message, code = 500) {
        this.message = message;
        this.code = code;
    }
}

exports.HttpError = HttpError;
exports.emitError = emitError;
exports.onError = handler => errorHandlers.push(handler);

const ROOT = process.cwd();
const fs = require('fs');
const { camelToKebab } = require('./utils/case-convert');
const Router = require('./router');
const { getActionCaller, getController } = require('./utils/loader');
const { prepareHttpConnection, fetchBody, parseRequest, abortRequest } = require('./utils/http');
const dispatch = require('./dispatch');
const CORS = require('./utils/cors');

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

			for (const action of Object.getOwnPropertyNames(controller.__proto__)) {
				if (action[0] == '_' || action == 'onLoad' || action == 'constructor') {
					continue;
				}

				const handler = getActionCaller(controller, controller[action]);
				const requestHandler = async (res, req) => {
					prepareHttpConnection(req, res);
					if (res.aborted) return;

					if (req.getMethod() == 'post') await fetchBody(req, res);
					await dispatch.http(req, res, handler);
				};

				const routePath = `/${camelToKebab(controllerName)}/${camelToKebab(action)}`;
				// TODO: get request method through vanilla decorators
				app.get(routePath, requestHandler);
				app.post(routePath, requestHandler);

				if (config.supportOldCase) {
					const routePath = `/${controllerName}/${action}`;
					app.get(routePath, requestHandler);
					app.post(routePath, requestHandler);
				}
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

		await dispatch.http(req, res, ctx => {
			ctx.params = route.params;
			return route.target(ctx);
		});
	});

	// Handling web sockets
	app.ws('/socket', {
		maxPayloadLength: 16 * 1024 * 1024, // 16 Mb
		idleTimeout: config.ttl || 0,
		upgrade (res, req, context) {
			const ws = { isClosed: false };
			parseRequest(req, ws);

			res.upgrade(
				ws,
				ws.headers['sec-websocket-key'],
				ws.headers['sec-websocket-protocol'],
				ws.headers['sec-websocket-extensions'],
				context
			);
		},
		async open (ws) {
			try {
				ws.dispatch = await dispatch.ws(ws);
			} catch (err) {
				log.error('WebSocket request dispatch error', err);
			}
		},
		message (ws, msg, isBinary) { ws.dispatch.message(msg); },
		close (ws, code, msg) {
			ws.isClosed = true;
			ws.dispatch.error(code, msg);
		}
	});

	// Listening port
	app.listen(config.port, socket => {
		const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
		if (socket) log.success('Server started ' + status);
		else log.error('Can`t start server ' + status);
	});
})();
