const chalk = require('chalk');
module.exports = {
    info (text) {
        console.log(`${chalk.bgCyan.bold.white(' INFO ')} ${text}`);
    },
    success (text) {
        console.log(`${chalk.bgGreen.bold.white(' OK ')} ${text}`);
    },
    warn (text) {
        console.log(`${chalk.bgKeyword('orangered').bold.white(' WARN ')} ${text}`);
    },
    error (text, err) {
        console.log(`${chalk.bgRed.bold.white(' ERR ')} ${text}`);
        if (err) {
            if (!(err instanceof Array)) err = err.toString().split('\n');
            console.log(err.map(l => chalk.red(' │ ') + l).join('\n'));
            console.log(chalk.red(' └─'));
        }
    }
};
