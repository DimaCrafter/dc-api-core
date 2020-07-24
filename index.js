const uWS = require('uWebSockets.js');
require('./plugins').init();

const context = require('./context');
const dispatch = require('./dispatch');
const config = require('./config');
const log = require('./log');
const Router = require('./router');

const multipart = require('./utils/multipart');
const parseRequest = require('./utils/request-parser');

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
		res.writeHeader('Access-Control-Allow-Methods', 'GET, POST');
		res.writeHeader('Access-Control-Allow-Headers', 'content-type, session');
		res.writeHeader('Access-Control-Max-Age', '86400');
		res.writeHeader('Access-Control-Allow-Origin', config.origin || req.getHeader('origin'));
		res.writeStatus('200 OK');
		res.end();
	});

	// Dispatching requests
	app.any('/*', async (res, req) => {
		res.aborted = false;
		res.onAborted(() => res.aborted = true);
		req.path = req.getUrl();
		req._matchedRoute = Router.match(req.path);
		parseRequest(req, req);

		res.headers = {};
		res.headers['Access-Control-Allow-Origin'] = config.origin || req.getHeader('origin');
		res.headers['Access-Control-Expose-Headers'] = 'session';

		let body = Buffer.from('');
		const onData = new Promise((resolve, reject) => {
			res.onData((chunk, isLast) => {
				body = Buffer.concat([body, Buffer.from(chunk)]);
				if (isLast) {
					if (body.length == 0) return resolve();
					if (!req.headers['content-type']) return reject(['Content-Type header is required', 400]);
					const contentType = req.headers['content-type'].split(';');
					contentType[0] = contentType[0].toLowerCase();

					if (contentType[0] == 'application/json') {
						try { req.body = JSON.parse(body); }
						catch (err) { reject(['Wrong JSON data', 400]); }
					} else if (contentType[0] == 'application/x-www-form-urlencoded') {
						req.body = {};
						body.toString().split('&').forEach(line => {
							line = line.split('=');
							req.body[line[0]] = decodeURIComponent(line[1]);
						});
					} else if (contentType[0] == 'multipart/form-data') {
						req.body = multipart(contentType[1].slice(contentType[1].indexOf('boundary=') + 9), body);
						if (req.body.json) {
							try {
								Object.assign(req.body, JSON.parse(req.body.json.content.toString()));
								delete req.body.json;
							} catch (err) {
								reject(['Wrong JSON data', 400]);
							}
						}
					} else {
						reject(['Content-Type not supported', 400]);
					}

					resolve();
				}
			});
		});

		try {
			await onData;
			await dispatch.http(req, res);
		} catch (err) {
			(await context.getHTTP(req, res)).send(...err);
		}
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
