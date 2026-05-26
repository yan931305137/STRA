# @stra/shared — Public API (Umbrella)

> Layer: L0 Foundation | Platform: Node.js + Browser | Depends on: @stra/shared-core, @stra/shared-node, @stra/shared-web

## Public Exports (`import from '@stra/shared'`)

This is an **umbrella package** that re-exports everything from the three sub-packages:

- `@stra/shared-core` — Platform-agnostic utilities (logger, utils)
- `@stra/shared-node` — Node.js-specific utilities (path, hash)
- `@stra/shared-web` — Browser-specific utilities (reserved)

### Sub-path Exports

- `@stra/shared` — All exports (backward compatible)
- `@stra/shared/core` — Core-only exports (platform-agnostic)
- `@stra/shared/node` — Node.js-only exports

## Migration Guide

New code should import from the specific sub-package:

```typescript
// Browser packages — only import core (no node: deps)
import { createLogger, debounce } from '@stra/shared-core';

// Node.js packages — import node for path/hash + core re-exports
import { normalizePath, hashContent, createLogger } from '@stra/shared-node';

// Generic/backward-compatible — import umbrella
import { normalizePath, createLogger } from '@stra/shared';
```
