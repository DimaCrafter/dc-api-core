import { HttpRequest, HttpResponse, TemplatedApp } from 'uWebSockets.js';
import { ControllerBase, ControllerBaseContext, Request } from './base'

export class HTTPController extends ControllerBase {
	/** Parsed request payload */
	data?: any;

	/** Drop the connection without responding to the request */
	drop (): void;
	/** Redirect user to specified URL */
	redirect (url: Stirng): void;
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

export class HTTPControllerContext extends ControllerBaseContext<Request, HttpResponse> {
	constructor (req: Request, res: HttpResponse);
    init (): Promise<void>;

    send (data: any, code?: number, isPure?: boolean): void;
    drop (): void;
    redirect (url: string): void;
}

export function registerHTTPController (app: TemplatedApp, path: string, controller: HTTPController): void;
