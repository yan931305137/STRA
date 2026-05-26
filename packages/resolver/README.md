# @stra/resolver

**L4 Tooling** | 路径解析 — alias / node_modules / extension resolution

## 功能

- Alias resolution: 路径别名解析
- node_modules resolution: 包查找与解析
- Extension resolution: 文件扩展名自动补全
- Exports field: package.json exports 字段支持

## 铁律 / 约束

> ❌ 不包含 runtime 逻辑 | ❌ 不执行代码转换

## 安装

```bash
pnpm add @stra/resolver
```

## 使用

```typescript
import { /* ... */ } from '@stra/resolver';
```
