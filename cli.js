#!/usr/bin/env node
const config = require('./config');
if (config.isDev) {
    const ROOT = process.cwd();
    const log = require('./log');

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
