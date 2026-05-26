# @stra/starter

STRA Starter — scaffolded by `npx stra starter`.

## Getting Started

```bash
pnpm dev
```

## Structure

```
src/
├── tree.ts        # Semantic tree (SSOT) — createTree({ count: 0 })
├── actions.ts     # Actions (sole write entry) — inc / dec
├── App.tsx        # React view adapter — useSignal(tree.count)
├── main.tsx       # Entry point
└── vite-env.d.ts
```

## STRA Principles

- **Tree = SSOT** — `src/tree.ts` is the single source of truth
- **Action = Sole Write Entry** — `src/actions.ts` is the only way to mutate state
- **Signal = Sole Response** — `useSignal()` in `App.tsx` is the only way to react

## Build

```bash
pnpm build
```
