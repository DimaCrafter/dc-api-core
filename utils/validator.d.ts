export type ValidationResult = {
	error: string | null;
	success: boolean;
};

export type ValidationError = {
	name: string;
	error: string;
};

export type ValidationResponse = {
	errors: ValidationError[];
	filtered: Record<string, any>;
	success: boolean;
};

export type FieldSchema = {
	name: string;
	type?: 'string' | 'number' | 'boolean' | 'object' | 'bigint' | 'symbol' | 'function' | 'undefined' | 'array';
	enum?: any[];
	fields?: FieldSchema[];
	of?: FieldSchema;
	min?: number;
	max?: number;
	use?: (value: any) => ValidationResult;
	uses?: ((value: any) => ValidationResult)[];
};

export interface Validator {
	check (data: any, fields?: FieldSchema[]): ValidationResponse;
	email (email: string): ValidationResult;
	phone (phone: string): ValidationResult;
	password (password: string): ValidationResult;
	ObjectId (value: any): ValidationResult;
	hostname (hostname: string): ValidationResult;
	url (url: string): ValidationResult;
	inArray (array: any[]): (value: any) => ValidationResult;
}

declare const validator: Validator;
export default validator;

