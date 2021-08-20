const { ControllerBase, ControllerBaseContext } = require('./base');
const { parseRequest } = require('../utils/http');
const core = require('..');
const config = require('../config');
const log = require('../log');
const dispatch = require('../dispatch');
const Session = require('../session');

class SocketController extends ControllerBase {}

let connected = [];
const channels = new Set();
/**
 * @extends {ControllerBaseContext<import('./websocket').Socket, import('./websocket').Socket>}
 */
class SocketControllerContext extends ControllerBaseContext {
    /**
     * @param {import('./websocket').Socket} ws
     */
    constructor (ws) {
		// `req` and `res` in `getBase` used only to get
        // request/response values, that combined in `ws`
        super(ws, ws);

        this.type = 'ws';
    }

    _destroy () {
        const i = connected.indexOf(this);
        if (~i) connected.splice(i, 1);
    }

    /**
     * @param {string} sessionHeader
     */
    async init (sessionHeader) {
        if (Session.enabled) {
            try {
                this._session = await Session.parse(sessionHeader);
            } catch (err) {
                core.emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: err.message,
                    error: err
                });

                throw err;
            }
        }

        connected.push(this);
    }

    // emit(event, ...arguments);
    emit (...args) {
        if (this._req.isClosed) {
            return log.warn('Trying to send message via closed socket');
        }

        this._res.send(JSON.stringify(args));
    }

    emitFirst (filter, ...args) {
        for (const ctx of connected) {
            if (filter(ctx)) {
                ctx._res.send(JSON.stringify(args));
                break;
            }
        }
    }

    subscribe (channel) { channels.add(channel); }
    unsubscribe (channel) {
        if (channel) channels.delete(channel);
        else channels.clear();
    }

    broadcast (channel, ...args) {
        const payload = JSON.stringify(args);
        if (channel) {
            for (const ctx of connected) {
                if (ctx._channels.has(channel)) ctx._req.send(payload);
            }
        } else {
            for (const ctx of connected) {
                ctx._req.send(payload);
            }
        }
    }

    end (msg = '', code = 1000) {
        if (!this._req.isClosed) {
            this._res.end(code, msg);
        }
    }
}

/**
 * @param {import('uWebSockets.js').TemplatedApp} app
 * @param {string} path
 * @param {import('./websocket').SocketController} controller
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
	SocketControllerContext,
	registerSocketController
};
