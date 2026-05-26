# @stra/client

**L4 Tooling** | 浏览器 runtime — HMR client + module loader

## 功能

- HMR client: 浏览器端热更新客户端
- Module loader: ESM 模块加载器
- WebSocket 连接: 与 dev-server 通信

## 铁律 / 约束

> ❌ 不能导入 Node.js API | ❌ 不能依赖框架 (React/Vue)

## 安装

```bash
pnpm add @stra/client
```

## 使用

```typescript
import { /* ... */ } from '@stra/client';
```
