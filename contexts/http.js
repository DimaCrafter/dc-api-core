const { getResponseStatus, fetchBody, prepareHttpConnection } = require('../utils/http');
const { ControllerBase, ControllerBaseContext } = require('./base');
const { emitError, HttpError } = require('../errors');
const Session = require('../session');
const CORS = require('../utils/cors');
const config = require('../config');
const { camelToKebab } = require('../utils/case-convert');
const { getActionCaller } = require('../utils/loader');

class HttpController extends ControllerBase {}

class HttpControllerContext extends ControllerBaseContext {
    /**
	 * @param {import('./http').Request} req
	 * @param {import("uWebSockets.js").HttpResponse} res
	 */
    constructor (req, res) {
        super(req, res);

        this.type = 'http';
        this.data = req.body;
    }

    async init () {
        if (Session.enabled && this._req.headers.session) {
            try {
                this._session = await Session.parse(JSON.parse(this._req.headers.session));
            } catch (err) {
                emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: err.message,
                    error: err
                });

                throw err;
            }
        }
    }

    /**
     * @param {any} data
     * @param {number} code
     * @param {boolean} isPure
     */
    send (data, code = 200, isPure = false) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.cork(() => {
            this._res.writeStatus(getResponseStatus(code));
            CORS.normal(this._req, this._res);
            for (const header in this._res.headers) {
                this._res.writeHeader(header, this._res.headers[header]);
            }

            if (isPure) {
                if (!this._res.headers['content-type']) {
                    if (typeof data === 'string') {
                        this._res.writeHeader('Content-Type', 'text/plain');
                    } else if (data instanceof Buffer) {
                        this._res.writeHeader('Content-Type', 'application/octet-stream');
                    }
                }

                this._res.end(data);
            } else {
                this._res.writeHeader('Content-Type', 'application/json');
                this._res.end(JSON.stringify(data));
            }
        });
    }

    drop () {
        if (this._res.aborted) return;
        this._res.close();
    }

    /**
     * @param {import("uWebSockets.js").RecognizedString} url
     */
    redirect (url) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.writeStatus('302 Found');
        this._res.writeHeader('Location', url);
        this._res.end();
    }
}

function registerHttpController (app, path, controller) {
	for (const action of Object.getOwnPropertyNames(controller.__proto__)) {
		if (action[0] == '_' || action == 'onLoad' || action == 'constructor') {
			continue;
		}

		const handler = getActionCaller(controller, controller[action]);
		const requestHandler = async (res, req) => {
			prepareHttpConnection(req, res);
			if (res.aborted) return;

			if (req.getMethod() == 'post') await fetchBody(req, res);
			await dispatch(req, res, handler);
		};

		const routePath = path + '/' + camelToKebab(action);
		// TODO: get request method through vanilla decorators
		app.get(routePath, requestHandler);
		app.post(routePath, requestHandler);

		if (config.supportOldCase) {
			const routePath = path + '/' + action;
			app.get(routePath, requestHandler);
			app.post(routePath, requestHandler);
		}
	}
}

async function dispatch (req, res, handler) {
    const ctx = new HttpControllerContext(req, res);
    try {
        await ctx.init();
    } catch (err) {
        return ctx.send(err.toString(), 500);
    }

    try {
        const result = await handler(ctx);
        if (!res.aborted && result !== undefined) {
            ctx.send(result);
        }
    } catch (err) {
        if (err instanceof HttpError) {
            ctx.send(err.message, err.code);
            emitError({
                isSystem: true,
                type: 'DispatchError',
                ...err,
                error: err
            });
        } else {
            ctx.send(err.toString(), 500);
            emitError({
                isSystem: true,
                type: 'DispatchError',
                code: 500,
                message: err.message,
                error: err
            });
        }
    }
}

module.exports = {
	HttpController,
	HttpControllerContext,
	registerHttpController,
    dispatchHttp: dispatch
};
