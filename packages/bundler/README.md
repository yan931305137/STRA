# @stra/bundler

**L4 Tooling** | 构建系统 — graph-walk + tree-shaking + chunk generation

## 功能

- Graph-walk: 基于依赖图遍历构建
- Tree-shaking: 无用代码消除
- Chunk generation: 代码块拆分与生成

## 铁律 / 约束

> ❌ 不包含 runtime 逻辑 | ❌ 只读 module-graph 输出

## 安装

```bash
pnpm add @stra/bundler
```

## 使用

```typescript
import { /* ... */ } from '@stra/bundler';
```
