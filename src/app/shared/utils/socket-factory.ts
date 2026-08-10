// src/app/shared/utils/socket-factory.ts
//
// `import * as X from 'socket.io-client'` yields a real ES module namespace
// object, which is non-configurable/non-writable by spec — no spyOn or
// spyOnProperty trick can ever intercept it in unit tests. Routing the call
// through this overridable factory instead makes socket connections
// injectable/mockable in tests without changing runtime behavior: by
// default it just forwards to the real `io`.
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

export type SocketFactory = (uri: string, opts?: Partial<ManagerOptions & SocketOptions>) => Socket;

let currentFactory: SocketFactory = io;

export function createSocket(uri: string, opts?: Partial<ManagerOptions & SocketOptions>): Socket {
  return currentFactory(uri, opts);
}

/** Test-only: substitute the socket factory (e.g. to return a fake Socket). */
export function __setSocketFactoryForTests(factory: SocketFactory): void {
  currentFactory = factory;
}

/** Test-only: restore the real socket.io-client factory. */
export function __resetSocketFactory(): void {
  currentFactory = io;
}
