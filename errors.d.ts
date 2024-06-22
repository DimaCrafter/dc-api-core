export interface IErrorInfo {
    isSystem: boolean;
    type: string;
    error?: any;
}

export interface IDispatchErrorInfo extends IErrorInfo {
    isSystem: true;
    type: 'DispatchError';

    /** Message returned with response */
    message: any;
    /** Response code */
    code: number;
    /** Error name */
    name?: string;
}

export interface IDatabaseConnectionErrorInfo extends IErrorInfo {
    isSystem: true;
    type: 'DatabaseConnectionError';
    /** Connection name */
    name: string;
}

export interface ISessionErrorInfo extends IErrorInfo {
    isSystem: true;
    type: 'SessionError';
    code: 500;
    message: string;
}

export interface ISocketUnhandledErrorInfo extends IErrorInfo {
    isSystem: true;
    type: 'SocketUnhandledError';
    /** Disconnection code */
    code: number;
    /** Driver message */
    message: string;
}

export interface IRequestErrorInfo extends IErrorInfo {
    isSystem: true;
    type: 'RequestError';
    code: 400;
    url: string;
    /** Error message */
    message: any;
    /** Raw request body */
    body?: Buffer;
}

type KnownErrors = IDispatchErrorInfo | IDatabaseConnectionErrorInfo | ISessionErrorInfo | ISocketUnhandledErrorInfo | IRequestErrorInfo | IErrorInfo;

export function onError (handler: (info: KnownErrors) => void): void;
export function emitError (info: KnownErrors): void;
export function clearErrorStack (stack: string): string;
export function splitError (error: any): string[];

export class HttpError {
    public message: any;
    public code: number;
    constructor (message: any, code?: number);
}
