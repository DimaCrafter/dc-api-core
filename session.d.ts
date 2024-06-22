export const enabled: boolean;
export function cryptSession(id: any): {
    id: any;
    expires: any;
};
export function decodeSession(input: any): any;
export declare function init(): any;
export declare function parse(header: any): Promise<any>;
export declare function registerStore(StoreClass: any, id: any): void;
export declare function initSessions(): void;
