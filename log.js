const COLOR = 30;
const BG = 40;
const reset = '\x1B[0m';
const bold = '\x1B[1m';
let colors;
const ansi = (color, isBG = false) => `\x1B[${color + (isBG ? BG : COLOR)}m`;
if (process.env.COLORTERM) {
    if (process.env.COLORTERM == 'truecolor' || process.env.COLORTERM == 'x24') {
        const rgb = (color, isBG = false) => `\x1B[${8 + (isBG ? BG : COLOR)};2;${color[0]};${color[1]};${color[2]}m`;
        colors = [rgb([0, 192, 255], true), rgb([0, 192, 64], true), rgb([255, 112, 0], true), rgb([224, 0, 0], true), rgb([224, 0, 0])];
    } else if (~process.env.COLORTERM.indexOf('256color')) {
        const named = (color, isBG = false) => `\x1B[${8 + (isBG ? BG : COLOR)};5;${color}m`;
        colors = [named(39, true), named(35, true), named(202, true), named(160, true), named(160)];
    }
} else {
    colors = [ansi(6, true), ansi(2, true), ansi(3, true), ansi(1, true), ansi(1)];
}

const print = (color, caption, text) => process.stdout.write(`${colors[color] + ansi(7) + bold} ${caption} ${reset} ${text + reset}\n`);
module.exports = {
    text: text => process.stdout.write(text + '\n'),
    info: text => print(0, 'INFO', text),
    success: text => print(1, 'OK', text),
    warn: text => print(2, 'WARN', text),
    error (text, err) {
        print(3, 'ERR', text);
        if (err) {
            if (!(err instanceof Array)) err = err.toString().split('\n');
            for (const line of err) process.stdout.write(` ${colors[4]}│${reset} ${line}\n`);
            process.stdout.write(` ${colors[4]}└─${reset}\n`);
        }
    }
};
