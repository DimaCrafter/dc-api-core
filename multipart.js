function getInitial () {
	return {
		headers: [],
		content: [],
		buffer: 'headers'
	};
}

const CRLF = [0xd, 0xa];
const doubleCRLF = CRLF.length * 2;
function split (buffer, delimiter) {
	let matched = 0;
	let matchedLines = 0;
	let result = [getInitial()];
	for (let i = 0; i < buffer.length; i++) {
		const byte = buffer[i];
		const part = result[result.length - 1];
		part[part.buffer].push(byte);
        if (byte === CRLF[matchedLines++ % CRLF.length]) {
            if (matchedLines === doubleCRLF) {
                part[part.buffer].splice(-doubleCRLF, doubleCRLF);
                part.buffer = 'content';
                matchedLines = 0;
            }
        } else if (byte === delimiter[matched++]) {
            if (matched === delimiter.length) {
                part[part.buffer].splice(-delimiter.length, delimiter.length);
                result.push(getInitial());
                matched = 0;
            }
        } else {
            matchedLines = matched = 0;
        }
	}
	return result;
}

function parseHeader (target, raw) {
	const parts = raw.toString().split(';');
	const [type, value] = parts[0].split(':');
	switch (type.trim()) {
		case 'Content-Disposition':
			target.source = value.trim();
			parts.slice(1).forEach(part => {
				const [prop, propValue] = part.trim().split('=');
				target[prop] = propValue.replace(/"/g, '');
			});
			break;
		case 'Content-Type':
			target.type = value.trim();
			break;
	}
	return target;
}

module.exports = (boundary, body) => {
	let result = {};
	boundary = Buffer.from('--' + boundary.split('boundary=')[1]);
	split(body, boundary).forEach(part => {
		let data = {};
		part.headers = Buffer.from(part.headers).toString().split('\r\n');
		part.headers.forEach(l => parseHeader(data, l));
		data.content = Buffer.from(part.content);

		if (data.name) {
			result[data.name] = data;
			delete data.name;
		}
	});
	return result;
}
