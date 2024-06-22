const Path = require('path');
const { writeFileSync } = require('fs');

const { findPluginDirectory, pluginLoadEnd } = require('../utils/loader');
const { getArg } = require('../utils');


module.exports = class DbTypesGenerator {
	constructor (connector) {
		if (!connector.getModelInterface || !connector.getModelImports) {
			this.shouldUpdate = false;
		} else {
			const restartReason = getArg('--restart-reason');
			// Update file if running in development mode and restart was triggered by system reason or a model change
			this.shouldUpdate = restartReason && (restartReason[0] == '@' || restartReason.search(/(\/|\\)models\1/) != -1);
		}

		this.connector = connector;
		this.result = [];
		this.types = [];
	}

	add (schemaName, model) {
		if (!this.shouldUpdate) return;

		const { code, type } = this.connector.getModelInterface(schemaName, model);
		this.result.push(code);
		this.result.push('');

		this.types.push(`${schemaName}: ${type}`);
	}

	async write (configName) {
		if (!this.shouldUpdate) return;

		this.result.unshift('');
		this.result.unshift(this.connector.getModelImports());
		this.result.unshift(`// Generated at ${new Date().toLocaleString('en-GB')}`);

		let connectionName = '';
		if (configName.includes('.')) {
			connectionName = `'${configName.split('.')[1]}'`;
		}

		this.result.push(`import { connect } from '.'`);
		this.result.push(`const _db = connect(${connectionName});`);
		this.result.push(`const db: typeof _db & { ${this.types.join('; ')} } = <any> _db;`);
		this.result.push(`export default db`);
		this.result.push('');

		await pluginLoadEnd;
		const basePath = findPluginDirectory(this.connector._self);
		if (!basePath) return;

		const typingPath = Path.join(basePath, configName + '.ts');
		writeFileSync(typingPath, this.result.join('\n'));
	}
}
