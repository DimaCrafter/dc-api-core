const { ObjectId } = require('mongodb');

const validateValue = (value, schema, fieldName, index = null) => {
    const errors = [];
    const indexSuffix = index !== null ? `[${index}]` : '';
    const fullFieldName = `${fieldName}${indexSuffix}`;

    if (schema.type === 'array') {
        if (!Array.isArray(value)) {
            errors.push({ name: fullFieldName, error: 'Invalid type' });
            return errors;
        }

        if (schema.of) {
            value.forEach((item, idx) => {
                const itemErrors = validateValue(item, schema.of, fullFieldName, idx);
                errors.push(...itemErrors);
            });
        }

        if (schema.min && value.length < schema.min) {
            errors.push({ name: fullFieldName, error: 'Array is too short' });
        }

        if (schema.max && value.length > schema.max) {
            errors.push({ name: fullFieldName, error: 'Array is too long' });
        }
    } else {
        if (schema.type && typeof value !== schema.type) {
            errors.push({ name: fullFieldName, error: 'Invalid type' });
            return errors;
        }

        if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(value)) {
            errors.push({ name: fullFieldName, error: 'Invalid enum value' });
            return errors;
        }

        if (schema.min && value.length < schema.min) {
            errors.push({ name: fullFieldName, error: 'Value is too short' });
        }

        if (schema.max && value.length > schema.max) {
            errors.push({ name: fullFieldName, error: 'Value is too long' });
        }
    }

    if (schema.use) {
        const result = schema.use(value);
        if (!result.success) {
            errors.push({ name: fullFieldName, error: result.error });
        }
    }

    if (schema.uses && schema.uses.length > 0) {
        for (const use of schema.uses) {
            const result = use(value);
            if (!result.success) {
                errors.push({ name: fullFieldName, error: result.error });
                break;
            }
        }
    }

    return errors;
};

/**
 * Check if all fields are present in the data
 * @param {{
 *  name: string,
 *  type?: 'string' | 'number' | 'boolean' | 'object' | 'bigint' | 'symbol' | 'function' | 'undefined' | 'array',
 *  enum?: any[],
 *  fields?: Array<{...}>,
 *  * only for type == array
 *  of?: {
 *    type: 'string' | 'number' | 'boolean' | 'object' | 'bigint' | 'symbol' | 'function' | 'undefined' | 'array',
 *    enum?: any[],
 *    fields?: Array<{...}>,
 *    of?: {...},
 *    min?: number,
 *    max?: number,
 *    use?: (value: any) => { error: string, success: boolean },
 *    uses?: ((value: any) => { error: string, success: boolean })[]
 *  },
 *  min?: number,
 *  max?: number,
 *  use?: (value: any) => { error: string, success: boolean },
 *  uses?: ((value: any) => { error: string, success: boolean })[]
 * }[]} fields - The fields to check
 * @param {object} data - The data to check
 * @returns {{ errors: { name: string, error: string }[], filtered: object, success: boolean }} - The validation result
 */
module.exports.check = (data, fields = []) => {
    let errors = [];
    let filtered = {};

    if (!data) {
        errors.push({ name: 'data', error: 'Data is required' });
        
        return { errors, filtered, success: false };
    }
    
    for (const field of fields) {
        if (data[field.name] === undefined || data[field.name] === null) {
            errors.push({ name: field.name, error: 'Field is required' });
            continue;
        }

        let fieldValid = true;
        let fieldValue = data[field.name];

        if (field.type === 'object' && field.fields && Array.isArray(field.fields)) {
            if (typeof data[field.name] !== 'object' || Array.isArray(data[field.name]) || data[field.name] === null) {
                errors.push({ name: field.name, error: 'Invalid type' });
                continue;
            }

            const nestedValidation = module.exports.check(data[field.name], field.fields);
            if (!nestedValidation.success) {
                nestedValidation.errors.forEach(error => {
                    errors.push({ name: `${field.name}.${error.name}`, error: error.error });
                });
                continue;
            }
            fieldValue = nestedValidation.filtered;
        }

        if (field.type && field.type === 'array') {
            if(!Array.isArray(data[field.name])) {
                errors.push({ name: field.name, error: 'Invalid type' });
                continue;
            }

            if (field.of) {
                const filteredArray = [];
                data[field.name].forEach((item, index) => {
                    const itemErrors = validateValue(item, field.of, field.name, index);
                    if (itemErrors.length === 0) {
                        filteredArray.push(item);
                    } else {
                        errors.push(...itemErrors);
                    }
                });
                fieldValue = filteredArray;
            }

            if (field.min && data[field.name].length < field.min) {
                errors.push({ name: field.name, error: 'Array is too short' });
                fieldValid = false;
            }

            if (field.max && data[field.name].length > field.max) {
                errors.push({ name: field.name, error: 'Array is too long' });
                fieldValid = false;
            }

            if (field.use) {
                const result = field.use(data[field.name]);
                if (!result.success) {
                    errors.push({ name: field.name, error: result.error });
                    fieldValid = false;
                }
            }

            if (field.uses && field.uses.length > 0) {
                for (const use of field.uses) {
                    const result = use(data[field.name]);
                    if (!result.success) {
                        errors.push({ name: field.name, error: result.error });
                        fieldValid = false;
                        break;
                    }
                }
            }

            if (fieldValid) {
                filtered[field.name] = fieldValue;
            }
            continue;
        }

        if (field.type && field.type !== 'array' && field.type !== 'object') {
            if (typeof data[field.name] !== field.type) {
                errors.push({ name: field.name, error: 'Invalid type' });
                continue;
            }
        } else if (field.type === 'object' && (!field.fields || !Array.isArray(field.fields))) {
            if (typeof data[field.name] !== 'object' || Array.isArray(data[field.name]) || data[field.name] === null) {
                errors.push({ name: field.name, error: 'Invalid type' });
                continue;
            }
        }

        if (field.enum && Array.isArray(field.enum) && !field.enum.includes(data[field.name])) {
            errors.push({ name: field.name, error: 'Invalid enum value' });
            continue;
        }

        if (field.min && data[field.name].length < field.min) {
            errors.push({ name: field.name, error: 'Value is too short' });
            continue;
        }

        if (field.max && data[field.name].length > field.max) {
            errors.push({ name: field.name, error: 'Value is too long' });
            continue;
        }

        if (field.use) {
            const result = field.use(data[field.name]);
            if (!result.success) {
                errors.push({ name: field.name, error: result.error });
                continue;
            }
        }

        if(field.uses && field.uses.length > 0) {
            for (const use of field.uses) {
                const result = use(data[field.name]);
                if (!result.success) {
                    errors.push({ name: field.name, error: result.error });
                    continue;
                }
            }
        }

        filtered[field.name] = fieldValue;
    }

    return { errors, filtered, success: errors.length === 0 };
}

module.exports.email = (email) => {
    if (!email || typeof email !== 'string') {
        return { error: 'Invalid email', success: false };
    }
    
    email = email.trim();
    
    if (email.length > 254 || email.length < 3) {
        return { error: 'Invalid email', success: false };
    }
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
        return { error: 'Invalid email', success: false };
    }
    
    const [localPart, domain] = email.split('@');
    
    if (localPart.length > 64 || !domain || domain.length > 253) {
        return { error: 'Invalid email', success: false };
    }
    
    const domainParts = domain.split('.');
    if (domainParts.length < 2 || domainParts.some(part => part.length === 0)) {
        return { error: 'Invalid email', success: false };
    }
    
    return { error: null, success: true };
}

module.exports.phone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { error: 'Invalid phone', success: false };
    }
    
    phone = phone.trim();
    
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    
    if (!/^\+?\d+$/.test(cleanPhone)) {
        return { error: 'Invalid phone', success: false };
    }
    
    const digitCount = cleanPhone.replace(/\+/g, '').length;
    
    if (digitCount < 10 || digitCount > 15) {
        return { error: 'Invalid phone', success: false };
    }
    
    if (cleanPhone.startsWith('+') && cleanPhone.indexOf('+') !== cleanPhone.lastIndexOf('+')) {
        return { error: 'Invalid phone', success: false };
    }
    
    return { error: null, success: true };
}

module.exports.password = (password) => {
    if (!password || typeof password !== 'string') {
        return { error: 'Invalid password', success: false };
    }
    
    password = password.trim();
    
    if (password.length < 5 || password.length > 255) {
        return { error: 'Invalid password length', success: false };
    }
    
    return { error: null, success: true };
}

module.exports.ObjectId = (value) => {
    if (!ObjectId.isValid(value)) {
        return { error: 'Invalid ObjectId', success: false };
    }

    return { error: null, success: true };
}

module.exports.hostname = (hostname) => {
    if (!hostname || typeof hostname !== 'string') {
        return { error: 'Invalid hostname', success: false };
    }

    hostname = hostname.trim();

    if (hostname.length < 3 || hostname.length > 255) {
        return { error: 'Invalid hostname length', success: false };
    }

    if (hostname.startsWith('.') || hostname.endsWith('.')) {
        return { error: 'FQDN must not start or end with a dot', success: false };
    }

    if (hostname.indexOf('.') === -1) {
        return { error: 'FQDN must contain at least one dot', success: false };
    }

    const labels = hostname.split('.');
    for (let label of labels) {
        if (label.length < 1 || label.length > 63) {
            return { error: 'Hostname label length must be between 1 and 63 characters', success: false };
        }
        if (!/^[a-zA-Z0-9-]+$/.test(label)) {
            return { error: 'Invalid character in hostname label', success: false };
        }
        if (label.startsWith('-') || label.endsWith('-')) {
            return { error: 'Hostname label must not start or end with hyphen', success: false };
        }
    }

    const tld = labels[labels.length - 1];
    if (/^\d+$/.test(tld)) {
        return { error: 'FQDN TLD must not be all numeric', success: false };
    }

    return { error: null, success: true };
}

module.exports.inArray = (array) => {
    return (value) => {
        if (!array.includes(value)) {
            return { error: 'Invalid value', success: false };
        }
        
        return { error: null, success: true };
    }
}

module.exports.url = (url) => {
    if (!url || typeof url !== 'string') {
        return { error: 'Invalid URL', success: false };
    }

    url = url.trim();

    try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) {
            return { error: 'URL must start with http:// or https://', success: false };
        }

        if (!parsed.hostname || parsed.hostname.length < 3 || parsed.hostname.length > 255) {
            return { error: 'Invalid hostname in URL', success: false };
        }

        if (parsed.hostname.indexOf('.') === -1) {
            return { error: 'URL hostname must contain a dot', success: false };
        }

        if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(parsed.hostname)) {
            return { error: 'Local/Private/Loopback URLs are not allowed', success: false };
        }

        const labels = parsed.hostname.split('.');
        const tld = labels[labels.length - 1];
        if (/^\d+$/.test(tld)) {
            return { error: 'URL TLD must not be all numeric', success: false };
        }
    } catch (e) {
        return { error: 'Malformed URL', success: false };
    }

    return { error: null, success: true };
};