/**
 * @stra/shared-core - General-purpose utilities
 *
 * Platform-agnostic utilities that work in both Node.js and Browser.
 *
 * IMPORTANT: This module MUST NOT import any Node.js or Browser-specific APIs.
 */

/** Check if value is a non-null object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Deep merge two objects (right overrides left). */
export function deepMerge<T extends Record<string, unknown>>(
  left: T,
  right: Partial<T>,
): T {
  const result = { ...left } as Record<string, unknown>;
  for (const key of Object.keys(right)) {
    const lVal = result[key];
    const rVal = (right as Record<string, unknown>)[key];
    if (isObject(lVal) && isObject(rVal)) {
      result[key] = deepMerge(
        lVal as Record<string, unknown>,
        rVal as Record<string, unknown>,
      );
    } else {
      result[key] = rVal;
    }
  }
  return result as T;
}

/** Create a deferred promise. */
export interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Simple debounce function. */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced;
}

/** Throttle function. */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const throttled = ((...args: unknown[]) => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed >= ms) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        fn(...args);
      }, ms - elapsed);
    }
  }) as T & { cancel: () => void };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return throttled;
}

/** Unique ID generator (simple incrementing counter). */
let _idCounter = 0;
export function uniqueId(prefix = ''): string {
  return `${prefix}${++_idCounter}`;
}

/** Type-safe omit. */
export type OmitStrict<T, K extends keyof T> = T extends T ? Pick<T, Exclude<keyof T, K>> : never;
