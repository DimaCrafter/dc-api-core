type Class<T> = new (...args: any[]) => T;
type Instance<ClassType> = ClassType extends Class<infer T> ? T : never;

interface DatabaseConnection<ModelType> {
	[modelName: string]: ModelType;
	_self: Class<DatabaseConnection<ModelType>>;
}

interface ConnectionOptions {
	identifier: string
}

interface DatabaseDriverStatic<DriverType, ModelType> {
	/** Returns database connection by its name */
	connect (connection?: string, options?: ConnectionOptions): DatabaseConnection<ModelType> & DriverType
}

import { EventEmitter } from 'events'
export abstract class DatabaseDriver<ModelType> extends EventEmitter {
	public _name: string;
	public abstract constructor (options: object);
	public abstract connect (): Promise<void>;
	public abstract getModel (basePath: string, name: string): ModelType;

	emit (event: 'disconnected'): void;
}

type ExtractModelType<DriverClassType> = Instance<DriverClassType> extends DatabaseDriver<infer ModelType> ? ModelType : never;
export function registerDriver<DriverClassType> (driver: DriverClassType, driverName: string): DatabaseDriverStatic<Instance<DriverClassType>, ExtractModelType<DriverClassType>> & DriverClassType;

export function connect (configKey: string, options?: ConnectionOptions): DatabaseConnection<any>;
