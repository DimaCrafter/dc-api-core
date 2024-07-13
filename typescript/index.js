const tn = require('ts-node');

const Preprocessor = require('./preprocessor');
const config = require('../config');
const tsconfig = require('./tsconfig_run.json');


Preprocessor.attachHooks();

tn.register({
	compilerOptions: tsconfig.compilerOptions,
	ignore: ["\\.js(on)?$"],
	skipProject: true,
	// Skip type checking in production
	transpileOnly: !config.isDev,

	transformers: {
		before: [
			ctx => sourceFile => new Preprocessor(ctx, sourceFile).run()
		]
	}
});
