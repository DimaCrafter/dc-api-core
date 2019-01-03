const express = require('express');
const app = express();
app.set('json spaces', 4);

const ROOT = process.cwd();
const fs = require('fs');
const { getHTTPUtils } = require('./utils');

const config = require('./config');
const Plugins = require('./plugins');

(async () => {
    (config.plugins || []).forEach(plugin => require(plugin)(Plugins.utils));

    // Waiting startup.js
    if(fs.existsSync(ROOT + '/startup.js')) {
        console.log('[Core] Running startup script');
        let startup = require(ROOT + '/startup.js');
        if(typeof startup == 'function') startup = startup.apply({});
        if(startup instanceof Promise) await startup;
    }

    // Enabling session support
    const session = require('express-session');
    // TODO: custom session middleware
    const FileStore = require('session-file-store')(session);
    app.use(session({
        saveUninitialized: true,
        secret: config.session.secret,
        store: new FileStore({
            path: process.cwd() + '/sessions',
            ttl: (config.session.ttl || 36) * 60 * 60
        }),
        resave: false
    }));

    // Enabling body parser middleware
    app.use((req, res, next) => {
        req.body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => req.body += chunk);
        req.on('end', () => {
        	if (req.body === '') return next();
            // TODO: type check + file upload support
            try {
                req.body = JSON.parse(req.body);
            } catch {
                getHTTPUtils(req, res).send('Wrong request', 400);
                return;
            }
            next();
        });
    });

    // Dispatching requests
    const dispatch = require('./dispatch');
    require('express-ws')(app, config.ssl?server:undefined);
    app.ws('/ws', (ws, req) => dispatch.ws(req, ws));
    app.all('*', (req, res) => dispatch.http(req, res));

    // Listening port
    config.port = config.port || 8081;
    const listenArgs = [
        config.port,
        () => console.log('[Core] Started' + (config.ssl?' with SSL':'') + ' at port ' + config.port)
    ];

    if(config.ssl) {
        // Creating HTTPS server, if ssl enabled
        const https = require('https');
        var server = https.createServer({
            key: fs.readFileSync(config.ssl.key, 'utf8'),
            cert: fs.readFileSync(config.ssl.cert, 'utf8')
        }, app);
        server.listen(...listenArgs);
    } else app.listen(...listenArgs);
})();
