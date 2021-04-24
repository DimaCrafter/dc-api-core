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

module.exports = { camelToKebab };
