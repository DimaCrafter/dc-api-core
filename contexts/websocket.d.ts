import { TemplatedApp } from 'uWebSockets.js';
import { ControllerBaseContext } from './base';
import { ControllerBase } from './base'

/**
 * This class marks controller as a WebSocket handler.
 * It also helps IDE to show code suggestions.
 */
export class SocketController extends ControllerBase {
	/** Connection open hook, overridable */
	open (): void;
	/** Connection close hook, overridable */
	close (): void;
	/**
	 * Hook for handling WebSocket errors, overridable
	 * @param code WebSocket error code
	 * @param msg Error description (can be empty)
	 */
	error (code: number, msg: string): void;

	/**
	 * @param event Event name
	 * @param args Any JSON-serializable arguments for handler function
	 */
	emit (event: string, ...args: any[]): void;
	/**
	 * Makes current connection subscribed to specified channel
	 * @param channel Channel name
	 */
	subscribe (channel: string): void;
	/**
	 * Removes subscription on specified channel for current connection, otherwise removes all subscriptions
	 * @param channel Channel name
	 */
	unsubscribe (channel: string): void;
	/**
	 * Emits event for all conecctions that have subscription on specified channel.
	 * If channel name is null, event will be emitted for all active WebSocket connections.
	 * @param channel Channel name
	 * @param event Event name
	 * @param args Any JSON-serializable arguments for handler function
	 */
	broadcast (channel: string | null, event: string, ...args: any[]): void;
}

type Socket = Request & {
	isClosed: boolean,
	send (msg: stirng): void;
	end (code: number, msg: stirng): void;
};

export class SocketControllerContext extends ControllerBaseContext<Socket> {
	constructor (ws: Socket);

    init (sessionHeader: string): Promise<void>;
    emit (event: string, ...args: any[]): void;
    end (msg?: stirng, code?: number): void;
    _destroy (): void;

    subscribe (channel: string): void;
    unsubscribe (channel: string): void;
    broadcast (channel: string, ...args: any[]): void;
}

export function registerSocketController (app: TemplatedApp, path: stirng, controller: SocketController): void;
