# @stra/shared-web

**L0 Foundation** | Browser-specific utilities.

## Install

```bash
pnpm add @stra/shared-web
```

## Exports

- Re-exports everything from `@stra/shared-core`
- **Browser utilities** — reserved for browser-only helpers that cannot run in Node.js

## Platform Rules

- MUST NOT import `node:*` modules
- MAY import browser-only APIs (`window`, `document`, etc.)

See [PUBLIC_API.md](./PUBLIC_API.md) for the full API reference.
