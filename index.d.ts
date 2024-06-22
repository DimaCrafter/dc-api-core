import { SocketController } from './contexts/websocket'
import { HttpController } from './contexts/http'
import { Validated } from './typescript/validator'

export { SocketController, HttpController }

export type AwaitObject<T> = {
	[Key in keyof T]: Awaited<T[Key]>
};

export type Data<ValidationType extends Validated> = ValidationType['ctx'];
export type Query<ValidationType extends Validated> = ValidationType['ctx'];
