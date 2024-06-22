#!/usr/bin/env node
/**
 * @import { ChildProcessByStdio } from 'child_process'
 * @import { Readable } from 'stream'
 */

const log = require('./log');
const config = require('./config');
const { getFlag } = require('./utils');


if (config.isDev) {
    const ROOT = process.cwd();

    /** @type {ChildProcessByStdio<null, Readable, null>} */
    let core;

    /** @return {Promise<void> | void} */
    function stopCore () {
        if (!core || core.exitCode !== null) return;

        return new Promise(resolve => {
            core.kill();

            let timeout;
            core.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            timeout = setTimeout(() => core.kill(9), 500);
        });
    }

    let restarting = false;
    const { spawn } = require('child_process');
    const start = async reason => {
        if (restarting) return;

        restarting = true;
        await stopCore();

        log.text('');
        log.info('Starting API...');

        core = spawn(
            'node',
            [__dirname + '/index.js', ...process.argv.slice(2), '--restart-reason', reason],
            { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'inherit'] }
        );

        core.stdout.pipe(process.stdout);
        core.stdout.once('readable', () => restarting = false);

        core.once('exit', code => {
            if (code) {
                // Converting i64 (JS Number) to i32 code
                log.error('API server process crushed with code ' + (code | 0));
            } else if (!restarting) {
                log.info('API server process exited');
            }

            restarting = false;
        });
    };

    log.text('API will be restarted after saving any file');
    log.text('You can submit `rs` to restart server manually');
    start('@initial');

    process.stdin.on('data', line => {
        if (line.toString().trim() == 'rs') start('@manual');
    });

    const watch = require('watch');
    watch.watchTree(ROOT, {
        ignoreDotFiles: true,
        filter (file) {
            file = file.replace(/\\/g, '/').slice(file.lastIndexOf('/') + 1);

            if (config.ignore.indexOf(file) != -1) {
                return false;
            } else if (file.includes('/node_modules/')) {
                return false;
            } else {
                return true;
            }
        },
        interval: 0.075
    }, (path, curr, prev) => {
        if (typeof path == 'object' && !prev && !curr) return;
        start(path);
    });

    process.on('SIGINT', async () => {
        restarting = true;
        stopCore();
        process.exit();
    });
} else if (getFlag('--ts-build')) {
    if (!config.typescript) {
        log.warn('Typescript is not enabled');
        process.exit();
    }

    require('./typescript/build');
} else {
    require('.');
}
