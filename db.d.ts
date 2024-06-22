import { EventEmitter } from 'events'

type Class<T> = new (...args: any[]) => T;

interface ConnectionOptions {
	identifier: string
}

interface DatabaseDriverStatic<DriverType> {
	/** Returns database connection by its name */
	connect (connection?: string, options?: ConnectionOptions): DriverType;
	new (options: ConnectionOptions): DriverType;
}

type FindQuery<Doc> = {
	[Key in keyof Doc]?: Doc[Key] | FindQueryOp<Doc[Key]>;
}

declare interface FindQueryOp<T> {
	/** Lower that value */
	$lt?: T;
	/** Lower that value or equal */
	$lte?: T;
	/** Greater that value */
	$gt?: T;
	/** Greater that value or equal */
	$gte?: T;
	/** Not equal to value */
	$ne?: T;
}

declare abstract class Model<Doc = any, DocLike = Partial<Doc>> {
	public init: (() => Promise<boolean>) | undefined;

	public create (values: DocLike): Promise<Doc>;

	public find (query: FindQuery<Doc>): Promise<Doc[]>;
	public findOne (query: FindQuery<Doc>): Promise<Doc>;
	public findById (id: any): Promise<Doc>;

	public delete (query: FindQuery<Doc>): Promise<void>;
	public deleteOne (query: FindQuery<Doc>): Promise<void>;
	public deleteById (id: any): Promise<void>;

	public update (query: FindQuery<Doc>, values: DocLike): Promise<void>;
	public updateOne (query: FindQuery<Doc>, values: DocLike): Promise<void>;
	public updateById (id: any, values: DocLike): Promise<void>;
}

export abstract class DatabaseDriver<ModelType extends Model> extends EventEmitter {
	public readonly [modelName: string]: ModelType;
	public readonly _self: DatabaseDriverStatic<ModelType>;
	public readonly _name: string;

	protected constructor ();
	public abstract constructor (options: object);
	public abstract connect (): Promise<void>;
	public getModel (basePath: string, name: string): ModelType;
	public makeModel (name: string, schema: any): ModelType;

	emit (event: 'disconnected'): void;
}

type ExtractModelType<DriverClass> = InstanceType<DriverClass> extends DatabaseDriver<infer ModelType> ? ModelType : never;
export function registerDriver<DriverClass> (driver: DriverClass, driverName: string): DatabaseDriverStatic<InstanceType<DriverClass>>;
export function connectDatabase (configKey: string, options?: ConnectionOptions): DatabaseDriver<Model>;
export function makeModel (connector: DatabaseDriver, modelName: string, schema: Record<string, ModelField>): Model;

interface ModelFieldInfo {
	type: 'string' | 'text' | 'int' | 'long' | 'enum' | 'json'
}

class ModelField<T> {
	readonly info: ModelFieldInfo;
	get required (): this;
	default (value: T): this;
}

class ModelString extends ModelField<string> {}
export function string (length?: number): ModelString;

class ModelText extends ModelField<string> {}
export function text (): ModelText;

class ModelJson extends ModelField<any> {}
export function json (): ModelJson;

class ModelInt extends ModelField<number> {}
export function int (): ModelInt;

class ModelLong extends ModelField<number> {}
export function long (): ModelLong;

class ModelEnum<V> extends ModelField<V[number]> {}
export function enumerable<T extends string, V extends T[]> (...values: V): ModelEnum<typeof values>;
