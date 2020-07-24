// Parse `req` data and store in `out`
module.exports = (req, out) => {
	let query = {};
	for (const pair of req.getQuery().split('&')) {
		if (!pair) continue;
		let eqPos = pair.indexOf('=');
		if (~eqPos) {
			query[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
		} else {
			query[pair] = true;
		}
	}
	out.query = query;

	out.headers = {};
	req.forEach((k, v) => out.headers[k] = v);
}
