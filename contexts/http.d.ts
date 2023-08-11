import { HttpRequest, HttpResponse, TemplatedApp } from 'uWebSockets.js';
import { ControllerBase, ControllerBaseContext } from './base'

export class HttpController extends ControllerBase {
	/** Parsed request payload */
	data?: any;
	/** Parameters parsed from route path */
	params?: { [param: string]: string };

	/** Drop the connection without responding to the request */
	drop (): void;
	/** Redirect user to specified URL */
	redirect (url: string, code?: number): void;
	/**
	 * Send response to client and close connection
	 * @param data Payload to send
	 * @param code HTTP response code, by default 200
	 * @param isPure If true, then data will sended without transformations, otherwise data will be serialized, by default false
	 */
	send (data: any, code?: number, isPure?: boolean): void;
}

type Request = HttpRequest & {
	query?: object,
	body?: any,
	headers: { [key: string]: string }
};

export class HttpControllerContext extends ControllerBaseContext<Request, HttpResponse> {
	constructor (req: Request, res: HttpResponse);
    init (): Promise<void>;

    send (data: any, code?: number, isPure?: boolean): void;
    drop (): void;
    redirect (url: string): void;
}

export function registerHttpController (app: TemplatedApp, path: string, controller: HttpController): void;

export function dispatchHttp (req: HttpRequest, res: HttpResponse, handler: (ctx: HttpControllerContext) => void): Promise<void>;
