# @stra/shared-node

**L0 Foundation** | Node.js-specific utilities (path, hash).

## Install

```bash
pnpm add @stra/shared-node
```

## Exports

- Re-exports everything from `@stra/shared-core`
- **Node utilities** — `resolvePath()`, `hashContent()`, Node.js-only helpers

## Platform Rules

- MUST import `node:*` modules (Node.js only)
- MUST NOT be imported by browser-only packages

See [PUBLIC_API.md](./PUBLIC_API.md) for the full API reference.
