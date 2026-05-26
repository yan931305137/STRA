# @stra/react

**L2 UI Adapter** | React hook 集成 — useSTRA / useSignal / 语义树组件

## 功能

- useSTRA: 核心 hook，连接 STRA 运行时
- useSignal: Signal → React state 桥接
- SemanticTree / SemanticSubtree: 语义树渲染组件
- useSignalBridge: 增强版 Signal 桥接（带依赖追踪）
- useSTRAAction: Action 隔离调用 hook
- STRAPortalRenderer: Portal 渲染器

## 铁律 / 约束

> ❌ React state ≠ STRA state（必须隔离）| React 只是 View Adapter

## 安装

```bash
pnpm add @stra/react
```

## 使用

```typescript
import { /* ... */ } from '@stra/react';
```

## 构建工具

`vite lib`
