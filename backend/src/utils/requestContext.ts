import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  startedAt: number;
  dbQueryTimeMs: number;
  dbQueryCount: number;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  context: RequestContextStore,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}

export function addDbQueryTiming(durationMs: number): void {
  const store = requestContextStorage.getStore();
  if (!store) {
    return;
  }

  store.dbQueryTimeMs += durationMs;
  store.dbQueryCount += 1;
}
