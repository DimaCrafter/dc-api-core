const config = require('./config');
const log = require('./log');
const app = require('./app');

const { loadPlugins, getController, executeStartup, iterControllers } = require('./utils/loader');
const { initSessions } = require('./session');
const { camelToKebab } = require('./utils');
const router = require('./router');
const { prepareHttpConnection, fetchBody, abortRequest } = require('./utils/http');

const { SocketController, registerSocketController } = require('./contexts/websocket');
exports.SocketController = SocketController;
const { HttpController, registerHttpController, dispatchHttp } = require('./contexts/http');
exports.HttpController = HttpController;
const { NatsController, NatsSubscription, registerNatsConnection, registerNatsController, registerNatsSubscription } = require('./contexts/nats');
exports.NatsController = NatsController;
exports.NatsSubscription = NatsSubscription;


loadPlugins();

if (config.typescript) {
	log.info('Warming up TypeScript...');
	require('./typescript');
}

initSessions();

executeStartup().then(async () => {
	const natsControllers = [];
	const natsSubscriptions = [];

	// Preloading controllers
	for (let { name: controllerName } of iterControllers()) {
		try {
			const controller = getController(controllerName);

			if (controller instanceof NatsSubscription) {
				natsSubscriptions.push({ controllerName, controller });
			} else if (controller instanceof NatsController) {
				natsControllers.push({ controllerName, controller });
			} else if (controller instanceof SocketController) {
				registerSocketController('/' + camelToKebab(controllerName), controller);
			} else {
				registerHttpController('/' + camelToKebab(controllerName), controller);
			}
		} catch (error) {
			log.error(`Loading "${controllerName}" controller failed`, error);
			process.exit(-1);
		}
	}

	// HTTP server (skipped if port: false)
	if (config.port !== false) {
		// TODO: do smth with custom routes
		app.any('/*', async (res, req) => {
			prepareHttpConnection(req, res);
			const route = router.match(req.path);
			if (!route) {
				return abortRequest(res, 404, 'API endpoint not found');
			}

			if (req.getMethod() === 'post') await fetchBody(req, res);
			if (res.aborted) return;

			await dispatchHttp(req, res, ctx => {
				ctx.params = route.params;
				return route.target(ctx);
			});
		});

		app.listen(config.port, socket => {
			const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
			if (socket) {
				log.success('Server started ' + status);
			} else {
				log.error('Cannot start server ' + status);
			}
		});
	}

	if (config.nats) {
		try {
			const { connect } = require('nats');
			const nc = await connect({ servers: config.nats.url });

			exports.nats = nc;
			registerNatsConnection(nc);

			const prefix = config.nats.prefix || null;

			for (const { controllerName, controller } of natsControllers) {
				await registerNatsController(nc, prefix, camelToKebab(controllerName), controller);
			}

			for (const { controllerName, controller } of natsSubscriptions) {
				await registerNatsSubscription(nc, prefix, camelToKebab(controllerName), controller);
			}

			log.success('NATS connected to ' + config.nats.url);
		} catch (error) {
			log.error('NATS connection failed', error);
			process.exit(-1);
		}
	}
});
