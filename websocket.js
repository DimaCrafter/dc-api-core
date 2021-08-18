const config = require('./config');
const ControllerBase = require('./controller-base');
const dispatch = require('./dispatch');
const log = require('./log');
const { parseRequest } = require('./utils/http');

/**
 * This class marks controller as a WebSocket handler.
 * It also helps IDE to show code suggestions.
 */
class SocketController extends ControllerBase {
	/** Connection open hook, overridable */
	open () {}
	/** Connection close hook, overridable */
	close () {}
	/**
	 * Hook for handling WebSocket errors, overridable
	 * @param {number} code WebSocket error code
	 * @param {string} msg Error description (can be empty)
	 */
	error (code, msg) {}

	/**
	 * @param {string} event Event name
	 * @param {any[]} args Any JSON-serializable arguments for handler function
	 */
	emit (event, ...args) {}
	/**
	 * Makes current connection subscribed to specified channel
	 * @param {string} channel Channel name
	 */
	subscribe (channel) {}
	/**
	 * Removes subscription on specified channel for current connection, otherwise removes all subscriptions
	 * @param {string} channel Channel name
	 */
	unsubscribe (channel) {}
	/**
	 * Emits event for all conecctions that have subscription on specified channel.
	 * If channel name is null, event will be emitted for all active WebSocket connections.
	 * @param {string | null} channel Channel name
	 * @param {string} event Event name
	 * @param  {...any} args Any JSON-serializable arguments for handler function
	 */
	broadcast (channel, event, ...args) {}
}

/**
 * @param {import('uWebSockets.js').TemplatedApp} app
 * @param {string} path
 * @param {SocketController} controller
 */
function registerSocketController (app, path, controller) {
	app.ws(path, {
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
				ws.dispatch = await dispatch.ws(ws, controller);
			} catch (err) {
				log.error('WebSocket request dispatch error', err);
			}
		},
		message (ws, msg, isBinary) { ws.dispatch.message(msg, isBinary); },
		close (ws, code, msg) {
			ws.isClosed = true;
			ws.dispatch.error(code, msg);
		}
	});
}

module.exports = {
	SocketController,
	registerSocketController
};
