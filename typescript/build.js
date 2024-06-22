const esbuild = require('esbuild');
const tn = require('ts-node');
const fs = require('fs');
const Path = require('path');

const config = require('../config');
const Preprocessor = require('./preprocessor');
const tsconfig = require('./tsconfig_build.json');
const { getFlag, camelToKebab } = require('../utils');
const { iterControllers, loadPlugins, locateStartupScript } = require('../utils/loader');


const ROOT = process.cwd();
const BUILD_DIR = Path.join(ROOT, 'build');
const KEEP_UWS = getFlag('--keep-uws');
const PRODUCE_SOURCE_MAP = getFlag('--sourcemap');
const NO_MINIFY = getFlag('--no-minify');

loadPlugins();
const startupPath = locateStartupScript();

const chores = [
	{
		ends: Path.join('dc-api-core', 'index.js'),
		replace: [
			{
				match: /iterControllers\(\)/g,
				content: '[]'
			}
		]
	},
	{
		ends: Path.join('dc-api-core', 'utils', 'loader.js'),
		replace: [
			{
				region: ':loadPlugins',
				content: (config.plugins || [])
					.map(plugin => `
						try {
							require('${plugin}');
							log.success(\`Plugin "${plugin}" loaded\`);
						} catch (error) {
							log.error(\`Cannot load plugin "${plugin}"\`, error);
							process.exit(-1);
						}
					`)
					.join('')
			},
			{
				match: /iterPlugins\(\)/g,
				content: '[]'
			},
			{
				region: ':startupLocate',
				content: `return ${!!startupPath};`
			},
			{
				region: ':startupLoad',
				content: startupPath ? `let startup = require(${JSON.stringify(startupPath)});` : 'return;'
			}
		]
	},
	{
		ends: Path.join('dc-api-core', 'db.js'),
		replace: [
			{
				match: /\/\/ #paste :modelsMap/,
				content: `
					const modelsMap = {${
						fs.readdirSync(Path.join(ROOT, 'models'))
							.map(dbConfigName => `
								['${dbConfigName}']: {${
									fs.readdirSync(Path.join(ROOT, 'models', dbConfigName))
										.map(modelName => `${modelName.slice(0, -3)}: require(${JSON.stringify(Path.join(ROOT, 'models', dbConfigName, modelName))})`)
										.join(',')
								}}
							`)
							.join(',')
					}};
				`
			},
			{
				region: ':iterModels',
				content: `
					for (const name in modelsMap[dbConfigName]) {
						const schema = modelsMap[dbConfigName][name];
						yield { name, schema };
					}
				`
			}
		]
	}
];

Preprocessor.attachHooks();
fs.rmSync(BUILD_DIR, { recursive: true, force: true });

const compiler = tn.create({
	compilerOptions: tsconfig.compilerOptions,
	ignore: ["(?:^|/)node_modules/", "\\.js(on)?$"],
	skipProject: true,
	transformers: {
		before: [
			ctx => sourceFile => new Preprocessor(ctx, sourceFile).run()
		]
	}
});

function processFile (path) {
	const relativePath = Path.relative(ROOT, path);
	console.log('Transpiling', relativePath);

	let transpiled = compiler.compile(fs.readFileSync(path, 'utf8'), path);
	transpiled = transpiled.replace(/^global\.fakeUsage.+$/m, '');

	return transpiled;
}

/**
 * @param {esbuild.OnLoadArgs} args
 * @returns {esbuild.OnLoadResult | null}
 */
function loadFile ({ path }) {
	if (path.endsWith('.ts')) {
		let relativePath = Path.relative(ROOT, path);
		// yarn link fix
		if (relativePath.startsWith('..')) {
			relativePath = relativePath.replace(/^(\.\.([\\\/]))+/, 'node_modules$2');
		}

		return { contents: processFile(path), loader: 'js' };
	} else if (!KEEP_UWS && path.endsWith('uws.js')) {
		let contents = fs.readFileSync(path, 'utf8');

		const currentBin = `./uws_${process.platform}_${process.arch}_${process.versions.modules}.node`;
		contents = contents.replace(/require\('\.\/uws_.+?\.node'\)/, `require('${currentBin}')`);

		return { contents };
	} else if (path.includes(`dc-api-core${Path.sep}typescript`)) {
		return { contents: '', loader: 'empty' };
	} else {
		for (const chore of chores) {
			if (path.endsWith(chore.ends)) {
				let contents = fs.readFileSync(path, 'utf8');

				for (const replacement of chore.replace) {
					if (replacement.match) {
						contents = contents.replace(replacement.match, replacement.content);
					} else if (replacement.region) {
						const startIndex = contents.indexOf(`// #region ${replacement.region}`);
						const endIndex = contents.indexOf('// #endregion', startIndex);
						const cutIndex = contents.indexOf('\n', endIndex);

						contents = contents.slice(0, startIndex) + replacement.content + contents.slice(cutIndex);
					}
				}

				return { contents };
			}
		}
	}

	return null;
}

const entrypoint = [
	"import { camelToKebab } from 'dc-api-core/utils'",
	"import { registerController } from 'dc-api-core/utils/loader'",
	"import { registerSocketController } from 'dc-api-core/contexts/websocket'",
	"import { registerHttpController } from 'dc-api-core/contexts/http'",
	""
];

for (const { name, path } of iterControllers()) {
	const controller = fs.readFileSync(path, 'utf-8');
	const match = new RegExp(`class\\s+${name}\\s.*?extends\\s+(Http|Socket)Controller`).exec(controller);
	const register = `register${match[1]}Controller`;

	entrypoint.push(`import { ${name} } from './${Path.relative(ROOT, path).replace(/\\/g, '/')}'`);
	entrypoint.push(`${register}('/${camelToKebab(name)}', registerController('${name}', ${name}));`);
}

esbuild.build({
	bundle: true,
	platform: 'node',
	target: 'node16',
	loader: { '.node': 'copy' },
	outfile: Path.join(BUILD_DIR, 'app.js'),
	legalComments: 'none',
	external: ['ts-node', 'typescript'],
	sourcemap: PRODUCE_SOURCE_MAP ? 'linked' : false,
	keepNames: true,
	minify: !NO_MINIFY,
	stdin: {
		contents: entrypoint.join('\n'),
		resolveDir: ROOT,
		sourcefile: '@@entrypoint.js'
	},
	plugins: [{
		name: 'dc-api-core',
		setup (build) {
			build.onLoad({ filter: /./ }, loadFile);
		}
	}]
}).then(() => {
	console.log('Generating assets...');

	const cfg = JSON.parse(fs.readFileSync(Path.join(ROOT, 'config.json'), 'utf-8'));
	delete cfg.dev;
	delete cfg.typescript;

	fs.writeFileSync(Path.join(BUILD_DIR, 'config.json'), JSON.stringify(cfg, null, '\t'), 'utf-8');

	const pkg = JSON.parse(fs.readFileSync(Path.join(ROOT, 'package.json'), 'utf-8'));
	delete pkg.dependencies;
	delete pkg.devDependencies;
	delete pkg.peerDependencies;

	pkg.scripts = {
		start: 'node app.js'
	};

	fs.writeFileSync(Path.join(BUILD_DIR, 'package.json'), JSON.stringify(pkg, null, '\t'), 'utf-8');

	console.log();
	console.log('Bundle is ready to use in `build` directory.');
	console.log('You can start it with `yarn start`, `npm start` or just `node app.js`.');
	console.log();
});
