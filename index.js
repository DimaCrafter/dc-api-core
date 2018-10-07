const express = require('express');
const app = express();
const getUtils = require('./utils');
app.set('json spaces', 4);

const ROOT = process.cwd();
const fs = require('fs');
const path = require('path');

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
            if(req.body.trim() !== '') {
                try {
                    req.body = JSON.parse(req.body);
                } catch {
                    getUtils(req, res).send('Wrong request', 400);
                    return;
                }
            }
            next();
        });
    });

    let loadedControllers = {};
    app.all('*', (req, res) => {
        const utils = getUtils(req, res, MainDB);
        function dispatch(controller, action) {
            controller.onLoad && controller.onLoad();
            if (action in controller) controller[action].apply(utils);
            else utils.send(`API ${controller.constructor.name}.${action} action not found`, 404);
        }

        let [controller, action] = req.path.split('/').slice(1);
        // Convert controller's name to PascalCase
        controller = controller.charAt(0).toUpperCase() + controller.slice(1);
        if (controller in loadedControllers) {
            // Dispatching cached controller
            dispatch(loadedControllers[controller], action);
        } else {
            const controllerPath = path.normalize(`${ROOT}/controllers/${controller}.js`);
            fs.access(controllerPath, fs.constants.F_OK | fs.constants.W_OK, (err) => {
                if(err && err.code == 'ENOENT') utils.send(`API ${controller} controller not found`, 404);
                else if(err) utils.send(`Can't access ${controller} controller`, 403);
                else {
                    let controller = require(controllerPath);
                    controller = new controller();
                    // Clear and don't save controller cache in devMode
                    config.devMode
                        ? delete require.cache[controllerPath]
                        : (loadedControllers[controller.constructor.name] = controller);
                    dispatch(controller, action);
                }
            });
        }
    });

    config.port = config.port || 8081;
    app.listen(config.port, function () {
        console.log('[Core] Started at port ' + config.port);
    });
})();