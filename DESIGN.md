# DESIGN.md

STRA visual design system — dark theme, semantic color coding per architecture layer.

## Color Palette

Each architecture layer has a dedicated semantic color:

| Layer | Color | Hex | Meaning |
|-------|-------|-----|---------|
| L0 Foundation | Graphite | `#2d2d3a` | Base, shared, omnipresent |
| L1 Runtime | Deep Indigo | `#1a1a2e` | Stable, core, unshakable |
| L2 UI Adapter | Indigo | `#6366f1` | Bridging, adapting |
| L3 Rendering | Emerald | `#00b894` | Projection, rendering |
| L4 Tooling | Amber | `#f0a500` | Tooling, scaffolding |
| LS1 Semantic | Teal | `#14b8a6` | Semantic extraction, meaning |
| LS2 Cache & Optimize | Cyan | `#06b6d4` | Cache hit, optimization |
| LS3 Dev & AI | Violet | `#8b5cf6` | DevTools, AI-aware |
| LS4 Distribution | Rose | `#f43f5e` | Distributed, remote |
| Danger/Constraint | Red | `#e74c3c` | Forbidden operations |

## Theme Tokens

```
--background: #0a0a0f
--foreground: #e8e8ed
--border: #1e1e2e
--card: #111118
--muted: #141420
--muted-foreground: #71717a
--primary: #6366f1
--destructive: #ef4444
--radius: 0.5rem
```

## Typography

- Code / IDs / Numbers: `font-mono`
- Labels: `text-[10px]`
- Panel titles: `text-xs font-medium`
- Body: `text-sm`
- Headings: `text-base font-semibold`

## Animation

- Signal change: emerald pulse (0.6s ease-out)
- Action dispatch: amber ripple
- Dirty clear: fade-out
- Node selection: left border highlight
- Tab switch: instant (no animation)
- Semantic cache hit: cyan flash
- AI guardrail block: violet shield pulse

## Package Architecture Visual Language

```
L0 ← L1 ← L2 ← L3 ← L4 ← LS1 ← LS2 ← LS3 ← LS4

@stra/shared-core ─┐
@stra/shared-node ─┤
@stra/shared-web ───┤
@stra/shared ───────┘
                    ↓
@stra/types ───────┐
@stra/core ────────┤
@stra/plugin ──────┘
                    ↓
@stra/react
                    ↓
@stra/renderer-core ┐
@stra/renderer-html ┤
@stra/dom ──────────┘
                    ↓
@stra/cli ──────────┐
@stra/transform ────┤
@stra/resolver ─────┤
@stra/devtools ─────┤
@stra/module-graph ─┤
@stra/hmr ──────────┤
@stra/client ───────┤
@stra/bundler ──────┤
@stra/dev-server ───┘
                    ↓
@stra/semantic ─────┐
@stra/semantic-diff ┤
@stra/causality ────┘
                    ↓
@stra/cache ────────┐
@stra/optimizer ────┘
                    ↓
@stra/semantic-devtools ┐
@stra/ai-compiler ─────┤
@stra/time-travel ─────┘
                    ↓
@stra/distributed-build
```

Each arrow is a dependency direction. Packages only import from lower layers.

## Semantic Bundler Pipeline Visual

```
Source Files
    ↓ [Phase 0] File Graph → Resolver → Transform → Chunk → HMR
    ↓ [Phase 1] Semantic Parser → Semantic Graph → Semantic ID/Hash → Action Boundary → Signal Tracker
    ↓ [Phase 2] Incremental Cache → Graph Cache → Action-level Rebuild → Semantic Chunking
    ↓ [Phase 3] Semantic HMR → Signal Patch → Tree Snapshot → Semantic Diff → State Preservation
    ↓ [Phase 4] Dead Signal Elimination → Action Inlining → Tree Flattening → Static Signal Extraction
    ↓ [Phase 5] Projection IR → Streaming Projection → Partial Hydration
    ↓ [Phase 6] Signal Inspector → Action Timeline → Graph Visualizer → Rebuild Analyzer
    ↓ [Phase 7] AI-aware Compiler → Runtime Guardrail → Intent→Action → Semantic Codegen
    ↓ [Phase 8] Distributed Build → Semantic Remote Cache → Parallel Graph Build
Output (HTML / DOM / Native / Canvas)
```

## Design Constraints

- Dark theme only — STRA is dark by default
- No "tech blue + rounded cards + purple gradient" default
- AI visuals must not intrude into the Core layer
- Renderer output is projection, never source of truth
- CLI is a thin shell — all logic lives in engine packages
- 5-layer base + 4-layer semantic extension with strict unidirectional dependency
- Semantic Hash > Content Hash — format changes must not trigger recompile
