# @stra/renderer-html

**L3 Rendering** | HTML 投影渲染器 — semantic tree → HTML

## 功能

- HTMLRenderer: 语义树 → HTML
- Renderer adapter 架构
- Incremental rendering

## 铁律 / 约束

> ❌ no state logic allowed | Renderer 不得包含业务逻辑

## 安装

```bash
pnpm add @stra/renderer-html
```

## 使用

```typescript
import { /* ... */ } from '@stra/renderer-html';
```

## 构建工具

`vite lib`
