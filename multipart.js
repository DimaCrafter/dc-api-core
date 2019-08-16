function parseHeader (raw) {
	let result = {};
	const parts = raw.split(';');
	const [type, value] = parts[0].split(':');
	switch (type.trim()) {
		case 'Content-Disposition':
			result.source = value.trim();
			parts.slice(1).forEach(part => {
				const [prop, propValue] = part.trim().split('=');
				result[prop] = propValue.replace(/"/g, '');
			});
			break;
		case 'Content-Type':
			result.type = value.trim();
			break;
	}
	return result;
}

module.exports = (type, body) => {
	const boundary = '--' + type.split('boundary=')[1];
	let parts = body.toString().split(boundary);
	let result = {};
	parts.forEach(part => {
		if(!part.trim()) return;
		let isLF = false;
		let i = 0;
		let isContent = false
		let data = { content: Buffer.alloc(0) };
		part.split(/\n/).forEach(line => {
			line = line.trim();
			if(!line) return isLF = true;
			if (!isContent) isContent = isLF && i++ === 1;

			if (isContent) {
				data.content = Buffer.concat([data.content, Buffer.from(line + '\n')]);
			} else {
				Object.assign(data, parseHeader(line));
			}
			isLF = false;
		});

		if (data.content.length) {
			result[data.name] = data;
			delete data.name;
		}
	});

	return result;
}
