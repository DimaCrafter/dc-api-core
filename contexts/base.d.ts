import { HttpRequest, HttpResponse } from 'uWebSockets.js'

export class ControllerBase {
	/** Information about client IP-address */
	address: {
		type: 'ipv4' | 'ipv6',
		value: string
	}

	/** Parsed query string */
	query?: object;

	/** Get request header */
	header (name: string): void;
	/** Set response header value */
	header (name: string, value: string): void;

	/** Contains all fiels and methods of current controller */
    controller: object;
}

export class ControllerBaseContext<In, Out> {
	protected _req: In;
	protected _res: Out;
	constructor (req: In, res: Out);

	public type: string;
}
