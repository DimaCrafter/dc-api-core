type Session = object & {
	_id: { toString (): string };
	/** Save current session data */
	save (): Promise<void>;
	/** Remove current session */
	destroy (): Promise<void>;

	[key: string]: any;
};

export class ControllerBase {
	/** Information about client IP-address */
	address: {
		type: 'ipv4' | 'ipv6',
		value: string
	}

	/** Parsed query string */
	query: Record<string, string>;
	/** Get request header */
	header (name: string): string;
	/** Set response header value */
	header (name: string, value: string): void;

	/** Contains all fiels and methods of current controller */
	controller: { [key: string]: any };
	session: Session;
}

export class ControllerBaseContext<In, Out> {
	protected _req: In;
	protected _res: Out;
	constructor (req: In, res: Out);

	public type: string;
	public get session (): Session;
	protected _session: Session | undefined;
	/** Contains all fiels and methods of current controller */
	controller: { [key: string]: any };

	/** You can store custom data attached to request or connection in controller's context */
	[key: string]: any;
}
