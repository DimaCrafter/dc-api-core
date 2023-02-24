const UPPER_CHARS = 'QWERTYUIOPLKJHGFDSAZXCVBNM';
const LOWER_CHARS = 'qwertyuioplkjhgfdsazxcvbnm';

function camelToKebab (value) {
    let isLastUpper = false;
    let result = '';

    for (const char of value) {
        const upperIndex = UPPER_CHARS.indexOf(char);
        if (upperIndex != -1) {
            if (!isLastUpper) result += '-';
            result += LOWER_CHARS[upperIndex];
            isLastUpper = true;
        } else {
            result += char;
            if (LOWER_CHARS.includes(char)) {
                isLastUpper = false;
            }
        }
    }

    return result[0] == '-' ? result.slice(1) : result;
}

function mergeObj (target, source) {
    Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object') {
            if (!target[key]) target[key] = source[key] instanceof Array ? [] : {};
            mergeObj(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    });
}

function getArg (name) {
    const i = process.argv.indexOf(name);
    return i == -1 ? null: process.argv[i + 1];
}

function getFlag (name) {
    return process.argv.includes(name);
}

module.exports = { camelToKebab, mergeObj, getArg, getFlag };
