# @stra/core

**L1 Runtime** | 语义运行时内核 — Tree + Signal + Action + Scheduler + Lifecycle

## 功能

- STRANode: 语义树节点（DAG + parent-child + relation edges）
- Signal: 响应式图（类似 SolidJS / MobX）
- Action: event → reducer-like pipeline
- Scheduler: microtask + 优先级队列
- Lifecycle: 节点生命周期钩子
- ActionPurityChecker: Action 纯度检查器
- RuntimeInvariantChecker: 运行时不变量检查（cycle detection, tree integrity, signal consistency）
- PriorityScheduler: 优先级调度器

## 铁律 / 约束

> ❌ 不渲染 ❌ 不解释 ❌ 不AI | 必须 deterministic

## 安装

```bash
pnpm add @stra/core
```

## 使用

```typescript
import { /* ... */ } from '@stra/core';
```

## 构建工具

`tsup`
