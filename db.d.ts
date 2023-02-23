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
	protected constructor ();
	public abstract constructor (options: object);
	public abstract connect (): Promise<void>;
	public abstract getModel (basePath: string, name: string, schema: any): ModelType;

	emit (event: 'disconnected'): void;
}

type ExtractModelType<DriverClass> = Instance<DriverClass> extends DatabaseDriver<infer ModelType> ? ModelType : never;
export function registerDriver<DriverClass> (driver: DriverClass, driverName: string): DatabaseDriverStatic<Instance<DriverClass>, ExtractModelType<DriverClass>> & DriverClass;

export function connect (configKey: string, options?: ConnectionOptions): DatabaseConnection<any>;

interface ModelFieldInfo {
	type: 'string' | 'text' | 'int' | 'enum'
}

class ModelField<T> {
	readonly info: ModelFieldInfo;
	get required (): this;
	default (value: T): this;
}

class ModelString extends ModelField<string> {}
export function string (length?: number): ModelString;

class ModelText extends ModelField<string> {
	get json (): this;
}
export function text (): ModelText;

class ModelInt extends ModelField<number> {}
export function int (): ModelInt;

class ModelEnum<V> extends ModelField<V[number]> {}
export function enumerable<T extends string, V extends T[]> (...values: V): ModelEnum<typeof values>;
