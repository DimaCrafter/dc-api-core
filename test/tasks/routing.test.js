const { testJSON } = require('./utils');

test('404 error', async () => {
	await testJSON('/random-not-found', 404, 'API endpoint not found');
});

test('URI cases', async () => {
	await testJSON('/test-endpoint/ping', 200, 'pong');
	await testJSON('/TestEndpoint/ping', 200, 'pong');
});

test('Custom route', async () => {
	const hash = (~~(Math.random() * 16**4)).toString(16).padStart(4, '0');
	await testJSON('/test-custom/h' + hash + '.json', 200, hash);
});

test('Private handlers', async () => {
	await testJSON('/test-endpoint/_private', 404, 'API endpoint not found');
});
