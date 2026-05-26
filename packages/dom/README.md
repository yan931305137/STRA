# @stra/dom

**L3 Rendering** | DOM 投影层 — semantic tree → DOM render

## 功能

- DOMRenderer: 语义树 → DOM 投影
- Fiber-like 渲染器架构
- Diff semantic node → DOM patch
- Reconciliation mismatch detection

## 铁律 / 约束

> ❌ DOM 只是投影，不是状态源 | ❌ 不允许业务逻辑

## 安装

```bash
pnpm add @stra/dom
```

## 使用

```typescript
import { /* ... */ } from '@stra/dom';
```

## 构建工具

`tsup`
