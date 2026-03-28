import { SocketController } from './contexts/websocket'
import { HttpController } from './contexts/http'
import { NatsController, NatsSubscription } from './contexts/nats'
import { NatsConnection } from 'nats'
import { Validated } from './typescript/validator'

export { SocketController, HttpController, NatsController, NatsSubscription }

/** Active NATS connection, available after server startup (only if nats is configured) */
export declare const nats: NatsConnection | undefined

export type AwaitObject<T> = {
	[Key in keyof T]: Awaited<T[Key]>
};

export type Data<ValidationType extends Validated> = ValidationType['ctx'];
export type Query<ValidationType extends Validated> = ValidationType['ctx'];
