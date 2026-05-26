# Contributing to STRA

Thank you for your interest in contributing to STRA (Semantic Tree Runtime)! This document provides guidelines for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0.0

### Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-org>/STRA.git
cd STRA

# Install dependencies
pnpm install

# Build all packages (layer order)
bash ./scripts/build.sh

# Start the playground app
pnpm dev
```

### Building Individual Layers

STRA uses a 5-layer base architecture + 4 semantic extension layers. Packages must be built in layer order:

```bash
# L0 Foundation
pnpm -r --filter '@stra/shared-core' --filter '@stra/shared-node' --filter '@stra/shared-web' --filter '@stra/shared' run build

# L1 Runtime
pnpm -r --filter '@stra/types' --filter '@stra/core' --filter '@stra/plugin' run build

# L2 UI Adapter
pnpm -r --filter '@stra/react' run build

# L3 Rendering
pnpm -r --filter '@stra/renderer-core' --filter '@stra/renderer-html' --filter '@stra/dom' run build

# L4 Tooling
pnpm -r --filter '@stra/cli' --filter '@stra/devtools' run build
pnpm -r --filter '@stra/resolver' --filter '@stra/transform' --filter '@stra/module-graph' run build
pnpm -r --filter '@stra/hmr' --filter '@stra/client' run build
pnpm -r --filter '@stra/bundler' run build
pnpm -r --filter '@stra/dev-server' run build

# LS1 Semantic Layer
pnpm -r --filter '@stra/semantic' --filter '@stra/semantic-diff' --filter '@stra/causality' run build

# LS2 Cache & Optimize
pnpm -r --filter '@stra/cache' --filter '@stra/optimizer' run build

# LS3 Dev & AI
pnpm -r --filter '@stra/semantic-devtools' --filter '@stra/ai-compiler' --filter '@stra/time-travel' run build

# LS4 Distribution
pnpm -r --filter '@stra/distributed-build' run build
```

Or use the single build script:

```bash
bash ./scripts/build.sh
```

## Architecture Principles

STRA follows three core principles that all contributions must respect:

1. **Tree = SSOT** — The semantic tree is the single source of truth
2. **Action = Sole Write Entry** — All state changes must go through Actions
3. **Signal = Sole Response System** — Reactivity is achieved through the Signal graph

### Three Iron Laws

1. **AI must not directly modify the runtime** — All AI output must pass through a safety gateway
2. **DOM must not reverse-affect state** — DOM is a projection, not a state source
3. **Renderer must not contain business logic** — Renderer is purely a projection

### Layer Dependencies

Packages are organized in strict layers. A package may only import from the same layer or a lower layer:

```
L0 ← L1 ← L2 ← L3 ← L4 ← LS1 ← LS2 ← LS3 ← LS4
```

Run the dependency graph check to verify:

```bash
npx tsx scripts/check-deps.ts
```

## Package Boundary Rules

- Each package's `exports` only declares `"."` entry — no sub-path imports
- Each package should have a `PUBLIC_API.md` documenting its public API
- `@stra/shared-core` cannot use `node:*` or browser-specific APIs
- `@stra/plugin` can only depend on L0/L1 packages
- `@stra/core` cannot import DOM or React dependencies
- `@stra/client` cannot import Node.js APIs (runs in browser)
- `@stra/hmr` cannot depend on frameworks (React/Vue)
- `@stra/semantic` can only depend on L0/L1/L4 packages
- `@stra/ai-compiler`'s Runtime Guardrail is the only legal channel for AI to write to tree

## Code Style

- TypeScript strict mode, no implicit `any`
- All function parameters and return types must be explicitly typed
- Package dependencies use `workspace:*` references within the monorepo
- Use pnpm only — npm and yarn are not allowed
- Follow the existing `.editorconfig` settings (2-space indent, LF line endings)

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add batch action scheduler
fix(react): resolve useSignal re-render loop
docs(readme): add quick start section
refactor(bundler): extract semantic chunking logic
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`feat/my-feature` or `fix/my-fix`)
3. Make your changes, respecting the architecture principles above
4. Run `pnpm ts-check` and `pnpm lint` to verify
5. Run `npx tsx scripts/check-deps.ts` to verify layer boundaries
6. Submit a pull request with a clear description

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
