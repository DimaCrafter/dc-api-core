const chalk = require('chalk');
module.exports = {
    info (text) {
        console.log(`${chalk.bgCyan.bold.white(' INFO ')} ${text}`);
    },
    success (text) {
        console.log(`${chalk.bgGreen.bold.white(' OK ')} ${text}`);
    },
    warn (text) {
        console.log(`${chalk.bgGolb.bold.white(' WARN ')} ${text}`);
    },
    error (text, err) {
        console.log(`${chalk.bgRed.bold.white(' ERR ')} ${text}`);
        err && console.log(err.toString().split('\n').map(l => chalk.red(' │ ') + l).join('\n') + '\n' + chalk.red(' └─'));
    }
};
