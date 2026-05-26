# @stra/hmr

**L4 Tooling** | 热更新 — WebSocket + patch + accept

## 功能

- WebSocket server/client: 热更新通信
- Patch generation: 增量补丁生成
- Module accept: 模块接受/拒绝热更新

## 铁律 / 约束

> ❌ 不能依赖框架 (React/Vue) | ❌ 不包含 runtime 逻辑

## 安装

```bash
pnpm add @stra/hmr
```

## 使用

```typescript
import { /* ... */ } from '@stra/hmr';
```
