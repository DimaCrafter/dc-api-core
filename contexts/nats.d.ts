import { NatsConnection } from 'nats'

/**
 * Marks controller as a NATS request-reply handler.
 * Each public method subscribes to a queue subject: `[prefix.]controller-name.method-name`
 * Methods receive `this.data` and reply by returning a value.
 */
export class NatsController {
    /** Hook called before every action method, overridable */
    onLoad (): void | Promise<void>;

    /** Parsed JSON payload from the incoming request */
    data: any;
    /** The NATS subject this message was received on */
    subject: string;
    /** Proxy to call other methods of the controller */
    controller: { [key: string]: any };

    /** You can store custom data in the controller context */
    [key: string]: any;
}

/**
 * Marks controller as a NATS pub-sub subscriber.
 * Each public method subscribes to a broadcast subject: `[prefix.]controller-name.method-name`
 * All instances receive every message. Can publish to other subjects via `this.publish()`.
 */
export class NatsSubscription {
    /** Hook called before every action method, overridable */
    onLoad (): void | Promise<void>;

    /** Parsed JSON payload from the incoming message */
    data: any;
    /** The NATS subject this message was received on */
    subject: string;
    /** Proxy to call other methods of the controller */
    controller: { [key: string]: any };

    /**
     * Publish a message to the given NATS subject
     * @param subject Target subject
     * @param data JSON-serializable payload
     */
    publish (subject: string, data: any): void;

    /** You can store custom data in the controller context */
    [key: string]: any;
}

export function registerNatsConnection (nc: NatsConnection): void;
export function registerNatsController (nc: NatsConnection, prefix: string | null, controllerName: string, controller: NatsController): Promise<void>;
export function registerNatsSubscription (nc: NatsConnection, prefix: string | null, controllerName: string, controller: NatsSubscription): Promise<void>;
