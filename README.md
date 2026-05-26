<p align="center">
  <img src="https://github.com/yan931305137/STRA/blob/master/docs/stra-logo.svg" width="180" alt="STRA Logo" />
</p>

<h3 align="center">Semantic Tree Runtime</h3>

<p align="center">
  A reactive state system where <strong>Tree</strong> is the single source of truth,<br/>
  <strong>Action</strong> is the sole write entry, and <strong>Signal</strong> is the sole response system.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Node.js->=18-green.svg" alt="Node.js >= 18" />
  <img src="https://img.shields.io/badge/pnpm->=9.0.0-orange.svg" alt="pnpm >= 9" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue.svg" alt="TypeScript 5" />
</p>

---

## What is STRA?

STRA is a **semantic-driven web frontend framework** designed for AI application scenarios. It enforces a strict separation of concerns through three core principles:

| Principle | Meaning |
|-----------|---------|
| **Tree = SSOT** | The semantic tree is the single source of truth for all application state |
| **Action = Sole Write Entry** | All state mutations must go through Actions — no direct mutations |
| **Signal = Sole Response System** | All reactivity flows through the Signal graph — no ad-hoc subscriptions |

This triad eliminates an entire class of bugs: stale state, race conditions, and uncontrolled side effects.

## Why Semantic Bundler?

Traditional bundlers (Webpack, Rollup, Vite) only understand **files**. STRA's Semantic Bundler understands **semantics** — Tree, Action, Signal. This enables:

- **Semantic Hash** — code format changes don't trigger recompile
- **Action-level Rebuild** — rebuild only affected actions, not entire files
- **Semantic Chunking** — split bundles by signal/action boundaries, not file boundaries
- **Semantic HMR** — update an action without reloading the entire tree
- **Dead Signal Elimination** — tree-shake unused reactive dependencies
- **Runtime Guardrail** — AI cannot directly modify tree, must go through validated actions

## Quick Start

### Create a project

```bash
npx stra my-app
cd my-app
pnpm dev
```

This scaffolds a new project with the recommended structure:

```
my-app/
├── src/
│   ├── tree.ts        # Semantic tree (SSOT)
│   ├── actions.ts     # Actions (sole write entry)
│   ├── App.tsx        # React component (view adapter)
│   └── main.tsx       # Entry point
├── stra.config.ts     # STRA configuration
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Manual Setup

```bash
pnpm add @stra/core @stra/react
```

```typescript
// tree.ts — Define your state
import { createTree } from '@stra/core'
export const tree = createTree({ count: 0 })

// actions.ts — Define how state changes
import { action } from '@stra/core'
import { tree } from './tree'
export const inc = action(() => { tree.count++ })

// App.tsx — Connect to React
import { useSignal } from '@stra/react'
import { tree } from './tree'
import { inc } from './actions'
export function App() {
  const count = useSignal(tree.count)
  return <button onClick={inc}>{count}</button>
}
```

## Architecture

STRA is organized as a 5-layer base + 4-layer semantic extension monorepo with strict dependency rules:

```
L0  Foundation      — @stra/shared-core, @stra/shared-node, @stra/shared-web, @stra/shared
L1  Runtime         — @stra/types, @stra/core, @stra/plugin
L2  UI Adapter      — @stra/react
L3  Rendering       — @stra/renderer-core, @stra/renderer-html, @stra/dom
L4  Tooling         — @stra/cli, @stra/transform, @stra/resolver, @stra/devtools,
                      @stra/module-graph, @stra/hmr, @stra/client,
                      @stra/bundler, @stra/dev-server

LS1 Semantic Layer  — @stra/semantic, @stra/semantic-diff, @stra/causality
LS2 Cache & Optimize— @stra/cache, @stra/optimizer
LS3 Dev & AI        — @stra/semantic-devtools, @stra/ai-compiler, @stra/time-travel
LS4 Distribution    — @stra/distributed-build
```

**Dependency direction**: `L0 ← L1 ← L2 ← L3 ← L4 ← LS1 ← LS2 ← LS3 ← LS4` — lower layers never depend on higher layers.

**CLI is a thin shell**: The `stra` command only parses arguments and delegates to engine packages.

### Core Packages

| Package | Layer | Description |
|---------|-------|-------------|
| `@stra/shared-core` | L0 | Platform-agnostic utilities (Node + Browser) |
| `@stra/shared-node` | L0 | Node.js utilities (path, hash) |
| `@stra/shared-web` | L0 | Browser utilities |
| `@stra/shared` | L0 | Umbrella package (re-exports all shared-*) |
| `@stra/types` | L1 | Type system, semantic IDs, branded types |
| `@stra/core` | L1 | Runtime kernel: Tree / Signal / Action / Scheduler |
| `@stra/plugin` | L1 | Plugin system: versioned contract, hooks |
| `@stra/react` | L2 | React integration: useSignal, STRProvider |
| `@stra/renderer-core` | L3 | Renderer plugin contract & Projection IR |
| `@stra/renderer-html` | L3 | HTML renderer: semantic tree → HTML |
| `@stra/dom` | L3 | DOM projection layer |
| `@stra/cli` | L4 | CLI thin shell: dev, build, create, inspect |
| `@stra/transform` | L4 | Code transformation engine (TS/JSX/SFC) |
| `@stra/resolver` | L4 | Path resolution (alias, node_modules) |
| `@stra/module-graph` | L4 | File dependency graph engine |
| `@stra/hmr` | L4 | Semantic HMR + Signal Patch + State Preservation |
| `@stra/client` | L4 | Browser runtime (HMR + module loader) |
| `@stra/bundler` | L4 | Build system + semantic chunking + action rebuild |
| `@stra/dev-server` | L4 | Dev server (HTTP + ESM + HMR) |

### Semantic Extension Packages

| Package | Layer | Description |
|---------|-------|-------------|
| `@stra/semantic` | LS1 | Semantic Parser + Graph + ID + Hash + Action Boundary + Tracker |
| `@stra/semantic-diff` | LS1 | Semantic diff engine (beyond AST diff) |
| `@stra/causality` | LS1 | Causal chain tracking (signal → component → renderer) |
| `@stra/cache` | LS2 | Incremental semantic cache + persistent graph cache |
| `@stra/optimizer` | LS2 | Dead signal elimination + action inlining + tree flattening |
| `@stra/semantic-devtools` | LS3 | Signal inspector + action timeline + graph visualizer |
| `@stra/ai-compiler` | LS3 | AI-aware compiler + runtime guardrail + intent→action |
| `@stra/time-travel` | LS3 | Tree snapshot + time travel debug |
| `@stra/distributed-build` | LS4 | Distributed build + semantic remote cache + parallel graph |

## Semantic Bundler Roadmap

| Phase | Theme | Key Innovation |
|-------|-------|----------------|
| 0 | Basic Bundler Engine | File graph, resolver, transform, chunk, HMR |
| 1 | Semantic Layer | Beyond file-level: extract Tree/Action/Signal semantics |
| 2 | Cache & Incremental | Unchanged semantics = no recompile |
| 3 | Semantic HMR | Update action without reloading tree |
| 4 | Compiler Optimization | Eliminate runtime, inline actions, flatten tree |
| 5 | Multi-target Rendering | Projection IR, streaming, partial hydration |
| 6 | Semantic DevTools | Inspect signal flow, not component tree |
| 7 | AI-aware Compilation | AI outputs are semantic, guardrailed by runtime |
| 8 | Distributed Build | Remote semantic cache, parallel graph build |

## Three Iron Laws

1. **AI must not directly modify the runtime** — all AI output passes through a safety gateway
2. **DOM must not reverse-affect state** — DOM is a projection, not a state source
3. **Renderer must not contain business logic** — renderers are pure projections

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/<your-org>/STRA.git
cd STRA

# Install dependencies
pnpm install

# Build all packages (respects layer ordering)
bash ./scripts/build.sh

# Start the playground app
pnpm dev

# Run dependency graph check
pnpm check-deps

# Run type checking
pnpm ts-check

# Run linting
pnpm lint
```

### CLI Commands

```bash
npx stra my-app      # Create a new project
npx stra dev         # Start dev server
npx stra build       # Build for production
npx stra inspect     # Inspect semantic graph
npx stra graph       # Output dependency graph
npx stra doctor      # Diagnose project issues
```

## Applications

| App | Description |
|-----|-------------|
| `@stra/demo` | Product showcase — semantic tree runtime + AI live demo |
| `@stra/playground` | Development debugging panel |
| `@stra/docs` | Documentation site |
| `@stra/starter` | Scaffolded starter app (`npx stra starter`) |
| `@stra/ai-frontend-benchmark` | Multi-framework automated evaluation system |

## Renderer Plugin Architecture

STRA's renderer system follows a contract/implementation pattern with Projection IR:

```
@stra/renderer-core (defines contract + Projection IR)  ← does not know about any specific renderer
@stra/renderer-html  (implements)                       ← registers with renderer-core
@stra/dom            (implements)                       ← registers with renderer-core
```

Adding a new renderer only requires implementing the `RendererPlugin` contract and registering it.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and architecture principles.

## License

[MIT](./LICENSE)
