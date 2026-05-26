# @stra/shared-core

**L0 Foundation** | Platform-agnostic utilities (Node.js + Browser), zero external dependencies.

## Install

```bash
pnpm add @stra/shared-core
```

## Exports

- **Logger** — `createLogger()`, `Logger`, `LoggerOptions`, `LogLevel`
- **Utilities** — `isObject()`, `deepMerge()`, `createDeferred()`, `debounce()`, `throttle()`, `uniqueId()`

## Platform Rules

- MUST NOT import `node:*` modules
- MUST NOT import browser-only APIs
- Works in both Node.js and Browser environments

See [PUBLIC_API.md](./PUBLIC_API.md) for the full API reference.
