const uWS = require('uWebSockets.js');
const utils = require('./utils');
const dispatch = require('./dispatch');
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

const Plugins = require('./plugins');
(async () => {
    // Waiting startup.js
    Plugins.init();
    if (fs.existsSync(ROOT + '/startup.js')) {
        log.info('Running startup script')
        let startup = require(ROOT + '/startup.js');
        if (typeof startup == 'function') startup = startup.apply({});
        if (startup instanceof Promise) await startup;
    }

    // Dispatching requests
    app.options('/*', async (res, req) => {
        res.writeHeader('Access-Control-Allow-Origin', config.origin || req.getHeader('origin'));
        res.writeHeader('Access-Control-Allow-Headers', 'content-type, token');
        res.writeHeader('Access-Control-Expose-Headers', 'token');
        res.writeStatus('200 OK');
        res.end();
    });

    app.any('/*', async (res, req) => {
        res.onAborted(() => res.aborted = true);
        req.path = req.getUrl();

        req.headers = {};
        req.forEach((k, v) => req.headers[k] = v);

        // CORS (i hate it)
        res.writeHeader('Access-Control-Allow-Origin', config.origin || req.getHeader('origin'));
        res.writeHeader('Access-Control-Expose-Headers', 'token');

        let body = Buffer.from('');
        const onData = new Promise((resolve, reject) => {
            res.onData((chunk, isLast) => {
                body = Buffer.concat([body, Buffer.from(chunk)]);
                if (isLast) {
                    if (body.length === 0) return resolve();
                    switch (req.headers['content-type']) {
                        case 'application/json':
                            try { req.body = JSON.parse(body); }
                            catch (err) { reject(['Wrong JSON data', 400]); }
                            break;
                        default:
                            reject(['Content-Type not supported', 400]);
                            break;
                    }
                    resolve();
                }
            });
        });

        try {
            await onData;
            await dispatch.http(req, res);
        } catch (err) {
            (await utils.getHTTP(req, res)).send(...err)
        }
    });

    // Hadling web sockets
    app.ws('/socket', {
        maxPayloadLength: 16 * 1024 * 1024, // 16 Mb
        async open (ws, req) {
            req.headers = {};
            req.forEach((k, v) => req.headers[k] = v);
            ws.dispatch = await dispatch.ws(ws, req);
        },
        message (ws, msg, isBinary) { ws.dispatch.message(msg); },
        drain (ws) {
            // ? What means `drain` event?
            // log.error('WebSocket backpressure: ' + ws.getBufferedAmount());
        },
        close (ws, code, msg) { ws.dispatch.error(code, msg); }
    });

    // Listening port
    app.listen(config.port, socket => {
        const status = `on port ${config.port} ${config.ssl ? 'with' : 'without'} SSL`;
        if (socket) log.success('Server started ' + status);
        else log.error('Can`t start server ' + status);
    });
})();
