const express = require('express');
const app = express();
app.set('json spaces', 4);

const ROOT = process.cwd();
const fs = require('fs');
const {getHTTPUtils} = require('./utils');

const config = require(ROOT + '/config.json');
if(!config.db) { console.log('[DB] Config must have connection details'); process.exit(); }
const DB = require('./DB');

(async () => {
    try {
        console.log(`[DB] Connecting to ${config.db.name} at ${config.db.host}`, config.db.user ? 'as ' + config.db.user : '');
        var MainDB = new DB(config.db, config.devMode);
        await MainDB.conn;
    } catch(err) {
        console.log('[DB]', err.name + ':', err.message);
        process.exit();
    } finally {
        console.log('[DB] Connected');
    }

    // Waiting startup.js
    if(fs.existsSync(ROOT + '/startup.js')) {
        console.log('[Core] Running startup script');
        const startup = require(ROOT + '/startup.js');
        if(typeof startup == 'function') startup = startup.apply({db: MainDB});
        if(startup instanceof Promise) await startup;
    }

    // Enabling session support
    const session = require('express-session');
    const MongoStore = require('connect-mongo')(session);
    app.use(session({
        saveUninitialized: true,
        secret: config.session.secret,
        store: new MongoStore({
            mongooseConnection: MainDB.conn,
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
            if(req.body !== '') {
                try {
                    req.body = JSON.parse(req.body);
                } catch {
                    getHTTPUtils(req, res).send('Wrong request', 400);
                    return;
                }
            }
            next();
        });
    });

    // Creating HTTPS server, if ssl enabled
    if(config.ssl) {
        const https = require('https');
        var server = https.createServer({
            key: fs.readFileSync(ROOT + '/' + config.ssl.key, 'utf8'),
            cert: fs.readFileSync(ROOT + '/' + config.ssl.cert, 'utf8')
        }, app);
    }

    // Dispatching requests
    const dispatch = require('./dispatch');
    dispatch.db = MainDB;
    require('express-ws')(app, config.ssl?server:undefined);
    app.ws('/ws', (ws, req) => dispatch.ws(req, ws));
    app.all('*', (req, res) => dispatch.http(req, res));

    // Listening port
    config.port = config.port || 8081;
    const listenArgs = [
        config.port,
        () => console.log('[Core] Started' + (config.ssl?' with SSL':'') + ' at port ' + config.port)
    ];

    if(config.ssl) server.listen(...listenArgs);
    else app.listen(...listenArgs);
})();