# @stra/dev-server

**L4 Tooling** | 开发服务器 — HTTP + ESM + transform + WS (Vite-like)

## 功能

- HTTP server: 静态资源服务
- ESM serving: 原生 ESM 模块服务
- Transform on-the-fly: 请求时转换代码
- WebSocket: HMR 通信通道

## 铁律 / 约束

> ❌ 不包含构建逻辑 (由 @stra/bundler 负责) | ❌ 不包含 runtime 逻辑

## 安装

```bash
pnpm add @stra/dev-server
```

## 使用

```typescript
import { /* ... */ } from '@stra/dev-server';
```
