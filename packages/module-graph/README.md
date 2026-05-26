# @stra/module-graph

**L4 Tooling** | 依赖图 — import/export tracking and HMR boundaries

## 功能

- Import/export tracking: 模块导入导出追踪
- HMR boundaries: 热更新边界检测
- Dependency graph: 文件依赖图构建

## 铁律 / 约束

> ❌ 不包含 runtime 逻辑 | ❌ 不执行代码转换

## 安装

```bash
pnpm add @stra/module-graph
```

## 使用

```typescript
import { /* ... */ } from '@stra/module-graph';
```
