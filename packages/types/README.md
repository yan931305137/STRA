# @stra/types

**L1 Runtime** | 全量类型系统 — STRA 生态的 TypeScript 类型定义层

## 功能

- Branded Types: NodeId, SignalId, ActionId 类型安全标识
- TreeNodeLike / TreeNode Schema: 语义树节点完整类型定义
- SchemaVersion + SchemaValidator: 版本化 schema 校验
- Renderer / RendererProjection: 渲染器抽象接口
- SemanticRelation / SemanticPatch: 关系与补丁类型
- AIActionIntent / AIAgentContext: AI 层类型定义

## 铁律 / 约束

> ❌ 不包含 runtime 逻辑，纯类型定义

## 安装

```bash
pnpm add @stra/types
```

## 使用

```typescript
import { /* ... */ } from '@stra/types';
```

## 构建工具

`tsup`
