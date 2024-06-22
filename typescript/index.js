const tn = require('ts-node');
const fs = require('fs');

const Preprocessor = require('./preprocessor');
const config = require('../config');
const tsconfig = require('./tsconfig_build.json');


const HACK_REGEX = /(Data|Query)<(.+?)>/g;

const __readFileSync = fs.readFileSync;
fs.readFileSync = function (path, encoding) {
	let result = __readFileSync.call(this, path, encoding);
	if (path.includes('controllers')) {
		const usages = [];

		let match;
		while (match = HACK_REGEX.exec(result)) {
			usages.push(match[2]);
		}

		result += `\n\n(<any> global).fakeUsage?.(${usages.join(', ')});`;
	}

	return result;
}

tn.register({
	compilerOptions: tsconfig.compilerOptions,
	ignore: ["(?:^|/)node_modules/", "\\.js(on)?$"],
	skipProject: true,
	// Skip type checking in production
	transpileOnly: !config.isDev,

	transformers: {
		before: [
			ctx => sourceFile => new Preprocessor(ctx, sourceFile).run()
		]
	}
});
