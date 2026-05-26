# @stra/renderer-core

**L3 Rendering** | 渲染器统一抽象层 — 所有 renderer 插件的契约基础。

## 为什么需要它

没有统一抽象，HTML/Console/SSR 渲染器各自为政，导致：
- 插件接口不统一，无法互换
- 渲染逻辑混入状态管理
- 无法统一校验渲染纯度

## 核心概念

### RendererPlugin

所有渲染器必须实现的插件契约：

```typescript
interface RendererPlugin {
  readonly id: string;
  readonly capabilities: ReadonlySet<RendererCapability>;
  render(ctx: RenderContext): RenderResult;
  dispose(): void;
}
```

### RendererPurityChecker

渲染纯度检查器 — 确保渲染函数无副作用：

```typescript
const checker = new RendererPurityChecker();
const result = checker.check(plugin, context);
// result.passed → true/false
// result.violations → 纯度违规列表
```

### RenderContext / RenderResult

渲染上下文与结果的标准类型，确保所有渲染器输入输出格式一致。

## 依赖

- `@stra/types` — 类型定义
- `@stra/core` — 运行时核心（只读，不修改状态）

## 边界约束

- 所有 renderer 插件必须依赖此包
- 禁止导入 AI 包（`@stra/ai-*`）
- 禁止导入 React/Next
- 渲染函数必须是纯函数
