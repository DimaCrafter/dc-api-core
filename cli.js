#!/usr/bin/env node
const ROOT = process.cwd();
const log = require('./log');
if (process.argv[2] == 'init') {
    const fs = require('fs');

    if (!fs.existsSync(ROOT + '/package.json')) {
        log.error('Package not initialized, run `npm init` or `yarn init` first');
        process.exit();
    }

    if (!fs.existsSync(ROOT + '/controllers')) {
        fs.mkdirSync(ROOT + '/controllers');
    }

    if (!fs.existsSync(ROOT + '/controllers/Info.js')) {
        log.info('Creating example controller...');
        fs.writeFileSync(ROOT + '/controllers/Info.js', `
// Importing \`package.json\` from installed \`dc-api-core\` package
const pkg = require('dc-api-core/package');

// Importing value from configuration
const { something_configurable } = require('dc-api-core/config');

// Exporting controller's class
module.exports = class Info {
    // Declaring a handler method that will accept requests
    // on URL http://localhost:8081/Info/status
    status () {
        // Sends an object with installed \`dc-api-core\` version
        // and current server time in response
        return {
            version: pkg.version,
            time: new Date().toLocaleString(),
            something_configurable
        };
    }
}
        `.trim() + '\n');
    }

    if (!fs.existsSync(ROOT + '/config.json')) {
        log.info('Creating example configuration file...');
        fs.writeFileSync(ROOT + '/config.json', JSON.stringify({
            port: 8081,
            something_configurable: 'Configured in production',
            dev: {
                something_configurable: 'Configured in development'
            }
        }, null, 4));
    }

    log.info('Creating dc-api-core scripts...');
    const pkg = JSON.parse(fs.readFileSync(ROOT + '/package.json').toString());

    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts.start = 'dc-api-core';
    pkg.scripts.dev = 'dc-api-core --dev';

    fs.writeFileSync(ROOT + '/package.json', JSON.stringify(pkg, null, 4));

    log.text('\nNow you can run `npm run dev` or `yarn dev` to start development server');
    log.text('and open http://localhost:8081/Info/status to see example controller output.');
    process.exit();
}

const config = require('./config');
if (config.isDev) {
    let core;
    let restarting = false;
    const { spawn } = require('child_process');
    const start = () => {
        if (restarting) return;

        restarting = true;
        if (core) core.kill();
        log.text('');
        log.info('Starting API...');
        core = spawn('node', [__dirname + '/index.js', ...process.argv.slice(2)], { cwd: ROOT });
        core.stderr.pipe(process.stderr);
        core.stdout.pipe(process.stdout);
        core.stdout.once('readable', () => restarting = false);
        core.on('exit', (code) => {
            if (code) log.error('API server process crushed with code ' + code);
            else if (!restarting) log.info('API server process exited');
        });
    };

    log.text('API will be restarted after saving any file');
    log.text('You can submit `rs` to restart server manually');
    start();
    process.stdin.on('data', line => {
        if (line.toString().trim() == 'rs') start();
    });

    const watch = require('watch');
    watch.watchTree(ROOT, {
        ignoreDotFiles: true,
        filter: file => {
            file = file.slice(file.lastIndexOf('/') + 1);
            if (~config.ignore.indexOf(file)) return false;
            return true;
        },
        interval: 0.075
    }, (path, curr, prev) => {
        if (typeof path == 'object' && !prev && !curr) return;
        start();
    });

    process.on('SIGINT', () => {
        restarting = true;
        if (core) core.kill();
        process.exit();
    });
} else {
    require('.');
}
