# @stra/shared-core — Public API

> Layer: L0 Foundation | Platform: Node.js + Browser | Zero external dependencies

## Public Exports (`import from '@stra/shared-core'`)

### Logger
- `createLogger(options?: LoggerOptions): Logger`
- `Logger` (interface)
- `LoggerOptions` (interface)
- `LogLevel` (type)

### General Utilities
- `isObject(value: unknown): value is Record<string, unknown>`
- `deepMerge<T>(left: T, right: Partial<T>): T`
- `createDeferred<T>(): Deferred<T>`
- `debounce<T>(fn: T, ms: number): T & { cancel }`
- `throttle<T>(fn: T, ms: number): T & { cancel }`
- `uniqueId(prefix?: string): string`
- `Deferred<T>` (interface)
- `OmitStrict<T, K>` (type)

## Internal (not exported)

None — this package is fully public.

## Platform Rules

- MUST NOT import `node:*` modules
- MUST NOT import browser-only APIs (`window`, `document`, `WebSocket`, etc.)
- Works in both Node.js and Browser environments
