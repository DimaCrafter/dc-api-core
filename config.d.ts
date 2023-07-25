// @ts-nocheck
import baseConfig from '../../config.json'

interface IConfigAdditions {
	/** Readonly, true if development mode enabled */
	readonly isDev: boolean;
}

const contents: typeof baseConfig & IConfigAdditions = baseConfig;
export = contents;
