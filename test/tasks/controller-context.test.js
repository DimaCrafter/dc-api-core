const { testJSON } = require('./utils');

test('this.controller', async () => {
	await testJSON('/test-endpoint/exposed-private', 200, 'secured content');
});
