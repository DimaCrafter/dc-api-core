function camelToKebab (value) {
    let isLastUpper = false;
    let result = '';

    for (const char of value) {
        if (char.toUpperCase() == char) {
            if (isLastUpper) result += char.toLowerCase();
            else result += '-' + char.toLowerCase();
            isLastUpper = true;
        } else {
            result += char;
            isLastUpper = false;
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

module.exports = { camelToKebab, mergeObj };
