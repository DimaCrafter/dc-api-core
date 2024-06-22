const { getResponseStatus, fetchBody, prepareHttpConnection } = require('../utils/http');
const { ControllerBase, ControllerBaseContext } = require('./base');
const { emitError, HttpError } = require('../errors');
const Session = require('../session');
const CORS = require('../utils/cors');
const config = require('../config');
const ValidationError = require('../typescript/ValidationError');
const { camelToKebab } = require('../utils');
const { getActionCaller } = require('../utils/loader');
const app = require('../app');

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
    }

    /**
     * @param {any} data
     * @param {number} code
     * @param {boolean} isPure
     */
    send (data, code = 200, isPure = false) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.cork(async () => {
            this._res.writeStatus(getResponseStatus(code));
            CORS.normal(this._req, this._res);
            for (const header in this._res.headers) {
                this._res.writeHeader(header, this._res.headers[header]);
            }

            if (this._session?._init) {
                this._res.writeHeader('session', JSON.stringify(await this._session._init));
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
    redirect (url, code = 302) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.cork(async () => {
            this._res.writeStatus(getResponseStatus(code));
            CORS.normal(this._req, this._res);
            this._res.writeHeader('Location', url);
            this._res.writeHeader('Content-Type', 'text/plain');
            this._res.end();
        });
    }

    // todo: inline
    // todo: add difference between "Data" and "Query" for ValidationError
    __validateData (TypeClass) {
        if (!this.data) {
            throw new ValidationError('Payload required');
        }

        return new TypeClass(this.data).validate();
    }

    __validateQuery (TypeClass) {
        if (!this.query) {
            throw new ValidationError('Query required');
        }

        return new TypeClass(this.query).validate();
    }
}

function registerHttpController (path, controller) {
	for (const action of Object.getOwnPropertyNames(controller.constructor.prototype)) {
		if (action[0] == '_' || action == 'onLoad' || action == 'constructor') {
			continue;
		}

		const handler = getActionCaller(controller, controller[action]);
		const requestHandler = async (res, req) => {
			prepareHttpConnection(req, res);
			if (res.aborted) return;

			if (req.getMethod() == 'post') await fetchBody(req, res);
            if (res.aborted) return;

			await dispatch(req, res, handler);
		};

		const routePath = path + '/' + camelToKebab(action);
		// TODO: get request method through vanilla decorators
		app.get(routePath, requestHandler);
		app.post(routePath, requestHandler);
	}
}

async function dispatch (req, res, handler) {
    const ctx = new HttpControllerContext(req, res);
    try {
        // Throws session parsing errors
        await ctx.init();
    } catch (error) {
        return ctx.send(error.toString(), 500);
    }

    try {
        const result = await handler(ctx);
        if (!res.aborted && result !== undefined) {
            ctx.send(result);
        }
    } catch (error) {
        if (error instanceof HttpError) {
            ctx.send(error.message, error.code);
            emitError({
                isSystem: true,
                type: 'DispatchError',
                message: error.message,
                code: error.code,
                error
            });
        } else {
            if (config.isDev) {
                ctx.send(error.toString(), 500);
            } else {
                ctx.send('InternalError', 500);
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
}

module.exports = {
	HttpController,
	HttpControllerContext,
	registerHttpController,
    dispatchHttp: dispatch
};
