const { ControllerBase, ControllerBaseContext } = require('./base');
const { parseRequest } = require('../utils/http');
const { emitError, HttpError } = require('../errors');
const config = require('../config');
const log = require('../log');
const Session = require('../session');

class SocketController extends ControllerBase {}

let connected = [];
function* getFilteredConnections (filter) {
    for (let i = 0; i < connected.length; i++) {
        const socket = connected[i];
        if (filter(socket)) yield socket;
    }
}

function getConnections (channel = null, isUnique = false) {
    if (channel) {
        if (isUnique) {
            const listed = [];
            return getFilteredConnections(socket => {
                if (socket._channels.has(channel)) {
                    const id = socket.session._id.toString();
                    if (~listed.indexOf(id)) return false;
                    else {
                        listed.push(id);
                        return true;
                    }
                } else {
                    return false;
                }
            });
        } else {
            return getFilteredConnections(socket => socket._channels.has(channel));
        }
    } else {
        return connected;
    }
}

function emitFirst (filter, ...args) {
    for (const ctx of connected) {
        if (filter(ctx)) {
            ctx._res.send(JSON.stringify(args));
            break;
        }
    }
}

function broadcast (channel, ...args) {
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
        this._channels = new Set();

        this.emitFirst = emitFirst;
        this.broadcast = broadcast;
    }

    _destroy () {
        const i = connected.indexOf(this);
        if (i != -1) connected.splice(i, 1);
    }

    /**
     * @param {string} sessionHeader
     */
    async init (sessionHeader) {
        if (Session.enabled) {
            try {
                // Throws session parsing errors
                this._session = await Session.parse(sessionHeader);
            } catch (error) {
                emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: error.message,
                    error
                });

                throw error;
            }
        }

        connected.push(this);
    }

    get session () {
        var session = super.session;
        if (this._session._init) {
            this._session._init.then(token => {
                if (this._req.isClosed) return;
                this.emit('session', token);
            });
        }

        return session;
    }

    // emit(event, ...arguments);
    emit (...args) {
        if (this._req.isClosed) {
            return log.warn('Trying to send message via closed socket');
        }

        this._res.send(JSON.stringify(args));
    }

    subscribe (channel) { this._channels.add(channel); }
    unsubscribe (channel) {
        if (channel) this._channels.delete(channel);
        else this._channels.clear();
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
				ws.dispatch = dispatch(ws, controller);
			} catch (error) {
				log.error('WebSocket request dispatch error', error);
			}
		},
		message (ws, msg, isBinary) { ws.dispatch.message(msg, isBinary); },
		close (ws, code, msg) {
			ws.isClosed = true;
			ws.dispatch.close(code, msg);
		}
	});
}

function catchError (ctx, error) {
    if (error instanceof HttpError) {
        ctx.emit('error', error.message, error.code);

        emitError({
            isSystem: true,
            type: 'DispatchError',
            ...error,
            error
        });
    } else {
        if (config.isDev) {
            ctx.emit('error', error.toString(), 500);
        }

        emitError({
            isSystem: true,
            type: 'DispatchError',
            code: 500,
            message: error.message,
            error
        });
    }
}

const WS_SYSTEM_EVENTS = ['open', 'close', 'error'];
/**
 * @param {import('./websocket').SocketController} controller
 */
function dispatch (ws, controller) {
    const obj = {};
    const ctx = new SocketControllerContext(ws);
    ctx.controller = controller;

    let initProgress;
    const init = async session => {
        try {
            await ctx.init(session);
        } catch (error) {
            return ctx.emit('error', error.toString(), 500);
        }

        try {
            if (controller.open) await controller.open.call(ctx);
        } catch (error) {
            return catchError(ctx, error);
        }

        initProgress = undefined;
    };

    if (!Session.enabled) initProgress = init();

    obj.message = async msg => {
        msg = Buffer.from(msg).toString();
        if (initProgress) await initProgress;
        try {
            const parsed = JSON.parse(msg);
            if (parsed[0] == 'session') {
                initProgress = init(parsed[1]);
                return;
            } else {
                await initProgress;
            }

            if (~parsed[0].indexOf(WS_SYSTEM_EVENTS)) return;
            if (parsed[0] in controller) {
                controller[parsed[0]].apply(ctx, parsed.slice(1));
            }
        } catch (error) {
            return catchError(ctx, error);
        }
    }

    obj.close = async (code, message) => {
        // @ts-ignore
        ctx._destroy();
        if (controller.close) controller.close.call(ctx);

        // 0 or 1000 - Clear close
        // 1001 - Page closed
        // 1005 - Expected close status, received none
        // 1006 & !message - Browser ended connection with no close frame.
        //                   In most cases it means "normal" close when page reloaded or browser closed
        if (code == 0 || code == 1000 || code == 1001 || (code == 1005 || code == 1006) && message.byteLength == 0) {
            return;
        }

        message = Buffer.from(message).toString();

        if (controller.error) {
            await controller.error.call(ctx, code, message);
        } else {
            log.error('Unhandled socket error', `WebSocket disconnected with code ${code}\nDriver message: ${message}`);
            emitError({
                isSystem: true,
                type: 'SocketUnhandledError',
                code,
                message
            });
        }
    }

    return obj;
}

module.exports = {
	SocketController,
	SocketControllerContext,
	registerSocketController,
    dispatchSocket: dispatch,

    emitFirst, broadcast, getConnections
};
