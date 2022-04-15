const config = require('./config');
const LOG_COLORS = {
    INFO: {
        ansi: 6,
        named: 39,
        rgb: [0, 192, 255]
    },
    OK: {
        ansi: 2,
        named: 35,
        rgb: [0, 192, 64]
    },
    WARN: {
        ansi: 3,
        named: 202,
        rgb: [255, 112, 0]
    },
    ERR: {
        ansi: 1,
        named: 160,
        rgb: [224, 0, 0]
    }
};

const FG = 30;
const BG = 40;
const RESET = '\x1B[0m';
const BOLD = '\x1B[1m';

const currentTheme = {};
function buildTheme (pallete) {
    let parser;
    switch (pallete) {
        case 'rgb':
            parser = (color, offset) => `\x1B[${offset + 8};2;${color[0]};${color[1]};${color[2]}m`;
            break;
        case 'named':
            parser = (color, offset) => `\x1B[${offset + 8};5;${color}m`;
            break;
        case 'ansi':
            parser = (color, offset = FG) => `\x1B[${color + offset}m`;
            break;
        default:
            process.stdout.write('Incorrect color pallete\n');
            process.exit();
    }

    for (const type in LOG_COLORS) {
        currentTheme[type] = parser(LOG_COLORS[type][pallete], BG);
    }

    currentTheme.ERR_LINE = parser(LOG_COLORS.ERR[pallete], FG);
    currentTheme.TEXT = parser(({ ansi: 7, named: 255, rgb: [255, 255, 255] })[pallete], FG);
}

if (config.colorPallette) {
    buildTheme(config.colorPallette);
} else {
    if (process.env.COLORTERM) {
        if (process.env.COLORTERM == 'truecolor' || process.env.COLORTERM == 'x24') {
            config.colorPallette = 'rgb';
        } else if (~process.env.COLORTERM.indexOf('256color')) {
            config.colorPallette = 'named';
        }
    } else {
        config.colorPallette = 'ansi';
    }

    buildTheme(config.colorPallette);
}

const print = (type, text) => process.stdout.write(`${currentTheme[type] + currentTheme.TEXT + BOLD} ${type} ${RESET} ${text + RESET}\n`);

exports.text = text => process.stdout.write(text + '\n'),
exports.info = text => print('INFO', text),
exports.success = text => print('OK', text),
exports.warn = text => print('WARN', text),
exports.error = (text, err) => {
    print('ERR', text);
    if (err) {
        if (!(err instanceof Array)) {
            err = err.toString().split('\n');
        }

        for (const line of err) {
            process.stdout.write(` ${currentTheme.ERR_LINE}│${RESET} ${line}\n`);
        }

        process.stdout.write(` ${currentTheme.ERR_LINE}└─${RESET}\n`);
    }
}
