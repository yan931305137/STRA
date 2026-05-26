# @stra/transform

**L4 Tooling** | 代码转换引擎 — TS/JSX/SFC pipeline

## 功能

- TypeScript transform: TS → JS 转换
- JSX transform: JSX → JS 转换
- SFC transform: 单文件组件解析
- Plugin pipeline: 可插拔的转换管线

## 铁律 / 约束

> ❌ 不包含 runtime 逻辑 | ❌ 不执行模块解析 (由 @stra/resolver 负责)

## 安装

```bash
pnpm add @stra/transform
```

## 使用

```typescript
import { /* ... */ } from '@stra/transform';
```
