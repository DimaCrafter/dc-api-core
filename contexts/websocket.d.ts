import { WebSocket } from 'uWebSockets.js'
import { ControllerBase, ControllerBaseContext } from './base'

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
	 * Send event with payload to current socket
	 * @param event Event name
	 * @param args Any JSON-serializable arguments for handler function
	 */
	emit (event: string, ...args: any[]): void;
	/**
	 * Send event with payload to first matched socket
	 * @param filter Socket matcher function
	 * @param event Event name
	 * @param args Any JSON-serializable arguments for handler function
	 */
	emitFirst (filter: (socket: SocketControllerContext) => boolean, event: string, ...args: any[]): void;
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
	 * Emits event for all connections that have subscription on specified channel.
	 * If channel name is null, event will be emitted for all active WebSocket connections.
	 * @param channel Channel name
	 * @param event Event name
	 * @param args Any JSON-serializable arguments for handler function
	 */
	broadcast (channel: string | null, event: string, ...args: any[]): void;
	/**
	 * Close socket connection
	 * @param message empty string by default
	 * @param code by default 1000 (closed without errors)
	 */
	end (message?: string, code?: number): void;
}

type Socket = WebSocket & {
	isClosed: boolean,
	send (msg: string): void;
	end (code: number, msg: string): void;
};

export class SocketControllerContext extends ControllerBaseContext<Socket, Socket> {
	constructor (ws: Socket);

    init (sessionHeader: string): Promise<void>;
    emit (event: string, ...args: any[]): void;
    end (msg?: string, code?: number): void;
    protected _destroy (): void;

    subscribe (channel: string): void;
    unsubscribe (channel: string): void;
    broadcast (channel: string, ...args: any[]): void;
}

export function registerSocketController (path: string, controller: SocketController): void;

/**
 * Send event with payload to first matched socket
 * @param filter Socket matcher function
 * @param event Event name
 * @param args Any JSON-serializable arguments for handler function
 */
export function emitFirst (filter: (socket: SocketControllerContext) => boolean, event: string, ...args: any[]): void;
/**
 * Emits event for all connections that have subscription on specified channel.
 * If channel name is null, event will be emitted for all active WebSocket connections.
 * @param channel Channel name
 * @param event Event name
 * @param args Any JSON-serializable arguments for handler function
 */
export function broadcast (channel: string | null, event: string, ...args: any[]): void;
/**
 * Returns all WebSocket connections
 */
export function getConnections (): SocketControllerContext[];
/**
 * Returns all WebSocket connections subscribed to specified channel
 * @param isUnique Enables sockets dedupe by session id
 */
export function getConnections (channel: string, isUnique?: boolean): Generator<SocketControllerContext, void>;
