import ValidationError from './ValidationError'
import { AwaitObject } from '..'


export type ValidatedCtor<T extends Validated> = new (raw: Record<string, any>) => T;

export class Validated {
	/** Awaited values only of getters and field **described above**. */
	ctx: AwaitObject<Omit<this, keyof Validated>> = <any> {};

	constructor (public raw: Record<string, any>) {
	}

	async validate (): Promise<this['ctx']> {
		for (const field of Object.getOwnPropertyNames(this)) {
			if (field == 'raw' || field == 'ctx') {
				continue;
			}

			(<any> this.ctx)[field] = await (<any> this)[field];
		}

		for (const member of Object.getOwnPropertyNames(this.constructor.prototype)) {
			if (member == 'constructor') {
				continue;
			}

			(<any> this.ctx)[member] = await (<any> this)[member];
		}

		return this.ctx;
	}
}

export function isNone (value: null | undefined) {
	return value === null || value === undefined;
}


type IGet<T, R> = (obj: T) => R;
type CommonDescriptor<R> = ClassGetterDecoratorContext<Validated, R> | ClassFieldDecoratorContext<Validated, R>;

function getGetter<R> (target: any, descriptor: CommonDescriptor<R>): IGet<Validated, R> {
	if (descriptor.kind == 'field') {
		return obj => obj.raw[<string> descriptor.name];
	} else {
		return obj => target.call(obj);
	}
}

/**
 * Throws an error with the specified message if the field is not provided
 * @param field If specified, the field with the specified name will be checked
 */
export function whenEmpty (message: string, field?: string) {
	return <R>(target: any, descriptor: CommonDescriptor<R>) => {
		const rawKey = field || <string> descriptor.name;
		const getValue = getGetter(target, descriptor);

		return function (this: Validated) {
			if (rawKey in this.raw) {
				return getValue(this);
			} else {
				throw new ValidationError(message, rawKey);
			}
		}
	};
}

type GetError = string | ((error: any) => string);

/**
 * If an error is caught, it throws a ValidationError with the specified message.
 * @param {GetError} message The error message or a function that returns the error message.
 * @param {string} field The name of the field to check for existence.
 */
export function whenError (message?: GetError, field?: string) {
	return <R>(target: any, descriptor: ClassGetterDecoratorContext<Validated, R> | ClassFieldDecoratorContext<Validated, R>) => {
		const rawKey = field || <string> descriptor.name;
		const getValue = getGetter(target, descriptor);

		return function (this: Validated) {
			try {
				return getValue(this);
			} catch (error: any) {
				let errorMessage: string;
				switch (typeof message) {
					case 'string':
						errorMessage = message;
						break;
					case 'function':
						errorMessage = message(error);
						break;
					case 'undefined':
						errorMessage = error.message || error.toString();
						break;
				}

				throw new ValidationError(errorMessage, rawKey);
			}
		}
	}
}
