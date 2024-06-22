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


loadPlugins();

if (config.typescript) {
	log.info('Warming up TypeScript...');
	require('./typescript');
}

initSessions();

executeStartup().then(() => {
	// Preloading controllers
	for (let { name: controllerName } of iterControllers()) {
		try {
			const controller = getController(controllerName);

			if (controller instanceof SocketController) {
				registerSocketController('/' + camelToKebab(controllerName), controller);
			} else {
				registerHttpController('/' + camelToKebab(controllerName), controller);
			}
		} catch (error) {
			log.error(`Loading "${controllerName}" controller failed`, error);
			process.exit(-1);
		}
	}

	// TODO: do smth with custom routes
	app.any('/*', async (res, req) => {
		prepareHttpConnection(req, res);
		const route = router.match(req.path);
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

	// Listening port
	app.listen(config.port, socket => {
		const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
		if (socket) {
			log.success('Server started ' + status);
		} else {
			log.error('Cannot start server ' + status);
		}
	});
});
