# AGENTS.md — STRA Semantic Tree Runtime

## 项目概览

STRA (Semantic Tree Runtime) — 语义驱动的 Web 前端框架，面向 AI 应用场景。

**核心三原则**：Tree 是唯一数据源 (SSOT)，Action 是唯一写入入口，Signal 是唯一响应系统。

**仓库结构**：pnpm workspace monorepo，包位于 `packages/`，应用位于 `apps/`，历史代码在 `_archive/`。

## 工具链架构

```
stra CLI (薄壳)
    ↓
@stra/dev-server
    ↓
@stra/bundler (语义打包)
    ↓
@stra/transform (AST 转换)
    ↓
@stra/semantic (语义图)
    ↓
@stra/core (响应式 runtime)
```

CLI 只负责解析参数和调用各包，不包含任何 engine 逻辑。

## 架构层级

5 层基础架构 + 4 层语义扩展，严格单向依赖 `L0 ← L1 ← L2 ← L3 ← L4 ← LS1 ← LS2 ← LS3 ← LS4`：

```
L0  Foundation      — @stra/shared-core, @stra/shared-node, @stra/shared-web, @stra/shared
L1  Runtime         — @stra/types, @stra/core, @stra/plugin
L2  UI Adapter      — @stra/react
L3  Rendering       — @stra/renderer-core, @stra/renderer-html, @stra/dom
L4  Tooling         — @stra/cli, @stra/transform, @stra/resolver, @stra/devtools,
                      @stra/module-graph, @stra/hmr, @stra/client,
                      @stra/bundler, @stra/dev-server

LS1 Semantic Layer  — @stra/semantic, @stra/semantic-diff, @stra/causality
LS2 Cache & Optimize— @stra/cache, @stra/optimizer
LS3 Dev & AI        — @stra/semantic-devtools, @stra/ai-compiler, @stra/time-travel
LS4 Distribution    — @stra/distributed-build
```

## 包清单

### L0 Foundation

| 包 | 职责 |
|---|------|
| `@stra/shared-core` | 平台无关工具 (Node + Browser)，零外部依赖 |
| `@stra/shared-node` | Node.js 专用工具 (path, hash) |
| `@stra/shared-web` | 浏览器专用工具 |
| `@stra/shared` | 伞包 (re-exports all shared-*) |

### L1 Runtime

| 包 | 职责 |
|---|------|
| `@stra/types` | 全局类型定义，branded types，semantic IDs |
| `@stra/core` | 运行时内核: Tree / Signal / Action / Scheduler / Lifecycle |
| `@stra/plugin` | 插件系统: versioned contract, hooks |

### L2 UI Adapter

| 包 | 职责 |
|---|------|
| `@stra/react` | React 集成: useSignal, STRProvider |

### L3 Rendering

| 包 | 职责 |
|---|------|
| `@stra/renderer-core` | 渲染器插件契约 & 注册中心 & Projection IR |
| `@stra/renderer-html` | HTML 渲染器: semantic tree → HTML |
| `@stra/dom` | DOM 投影层 |

### L4 Tooling

| 包 | 职责 |
|---|------|
| `@stra/cli` | CLI 薄壳: dev, build, create, inspect, graph, doctor |
| `@stra/transform` | 代码转换引擎 (TS/JSX/SFC) |
| `@stra/resolver` | 路径解析 (alias, node_modules, exports) |
| `@stra/devtools` | 调试工具基础设施 |
| `@stra/module-graph` | 文件依赖图引擎 |
| `@stra/hmr` | 语义热更新 (Semantic HMR + Signal Patch + State Preservation) |
| `@stra/client` | 浏览器 runtime (HMR + module loader) |
| `@stra/bundler` | 构建系统 (graph-walk + tree-shaking + semantic chunking + action-level rebuild) |
| `@stra/dev-server` | 开发服务器 (HTTP + ESM + HMR) |

### LS1 Semantic Layer

| 包 | 职责 |
|---|------|
| `@stra/semantic` | 语义解析器 + 语义图 + Semantic ID + Semantic Hash + Action Boundary + Signal Tracker |
| `@stra/semantic-diff` | 语义 diff engine (AST diff 不够，语义级 diff) |
| `@stra/causality` | 因果链追踪 (signal → component → renderer) |

### LS2 Cache & Optimize

| 包 | 职责 |
|---|------|
| `@stra/cache` | 增量语义缓存 + 持久化图缓存 + projection 缓存 |
| `@stra/optimizer` | 编译优化: dead signal elimination + action inlining + tree flattening + static signal extraction |

### LS3 Dev & AI

| 包 | 职责 |
|---|------|
| `@stra/semantic-devtools` | Signal Inspector + Action Timeline + Graph Visualizer + Rebuild Analyzer |
| `@stra/ai-compiler` | AI-aware Compiler + Runtime Guardrail + Intent→Action + Semantic Codegen + Refactor Engine |
| `@stra/time-travel` | Tree 快照 + time travel debug |

### LS4 Distribution

| 包 | 职责 |
|---|------|
| `@stra/distributed-build` | 分布式构建 + 语义远程缓存 + 并行图构建 |

### 归档包 (`_archive/`)

32 个已退役包，按方向分类：Intelligence / Analysis / Projection / Integration。不参与构建和 `pnpm install`，仅作为设计参考。

## 应用

| 应用 | 职责 |
|---|------|
| `@stra/demo` | 产品展示 — 语义树 runtime + AI 实时演示 |
| `@stra/playground` | 开发调试面板 |
| `@stra/docs` | 文档站 |
| `@stra/ai-frontend-benchmark` | 多框架自动化评测系统 |

## Semantic Bundler 路线图

9 Phase，从文件级构建到语义级构建的完整实现：

| Phase | 主题 | 对应包 | 状态 |
|-------|------|--------|------|
| 0 | 基础 Bundler 引擎 | module-graph, resolver, transform, bundler, hmr | ✅ |
| 1 | 语义层 | semantic (Parser/Graph/ID/Hash/Boundary/Tracker) | ✅ |
| 2 | 缓存与增量 | cache, bundler (semantic chunk/action rebuild) | ✅ |
| 3 | 语义热更新 | hmr (semantic HMR/signal patch/state preservation), semantic-diff, time-travel, causality | ✅ |
| 4 | 编译优化 | optimizer (dead signal/action inline/tree flatten/static extraction) | ✅ |
| 5 | 多目标渲染 | renderer-core (Projection IR/streaming/partial hydration) | ✅ |
| 6 | 语义 DevTools | semantic-devtools (inspector/timeline/visualizer/analyzer) | ✅ |
| 7 | AI 编译辅助 | ai-compiler (guardrail/codegen/intent-action/refactor) | ✅ |
| 8 | 分布式构建 | distributed-build (remote cache/parallel graph/distributed) | ✅ |

## 开发命令

- `pnpm install` — 安装所有依赖
- `bash ./scripts/build.sh` — 按层级顺序构建所有包
- `bash ./scripts/dev.sh` — 启动 demo 应用
- `pnpm dev` — 启动 playground 开发服务器
- `pnpm ts-check` — 全局类型检查
- `pnpm lint` / `pnpm lint:all` — 代码检查
- `pnpm check-deps` — 依赖图检查
- `npx stra my-app` — 创建新项目
- `npx stra dev` — 启动开发服务器
- `npx stra build` — 构建生产版本
- `npx stra inspect` — 检查语义图
- `npx stra graph` — 输出依赖图
- `npx stra doctor` — 诊断项目

## 编码规范

- TypeScript strict 模式，禁止隐式 any
- 函数参数、返回值、事件对象必须有明确类型
- 包间依赖通过 `workspace:*` 引用
- `_archive/` 下为历史代码，不参与类型检查和 lint
- 禁止在 renderer 中直接修改 runtime state
- 仅使用 pnpm，严禁 npm 或 yarn

## 关键设计决策

1. **CLI 是薄壳**：CLI 只负责解析参数和调用各包，不包含任何 engine 逻辑
2. **语义 hash 优于 content hash**：代码格式变化不触发重编译
3. **Action 是唯一写入入口**：所有 tree 变更必须通过 action
4. **Renderer 是投影**：renderer 只读 tree，生成投影，不修改源数据
5. **AI 不能直接改 tree**：必须通过 Runtime Guardrail 校验后通过 action 间接修改
6. **DOM 不可反向影响 state**：DOM 是投影，不是状态源
7. **Renderer 不可包含业务逻辑**：渲染器是纯投影

## 三大铁律

1. AI 不能直接修改 runtime — 所有 AI 输出必须通过安全网关
2. DOM 不能反向影响 state — DOM 是投影，不是状态源
3. Renderer 不能包含业务逻辑 — 渲染器是纯投影

## 包边界规则

- 每个包的 `exports` 只声明 `"."` 入口 — 无子路径导入
- 每个包有 `PUBLIC_API.md` 文档化其公共 API
- `@stra/shared-core` 不能使用 `node:*` 或浏览器专有 API
- `@stra/plugin` 只能依赖 L0/L1 包
- `@stra/core` 不能导入 DOM 或 React 依赖
- `@stra/client` 不能导入 Node.js API（运行在浏览器）
- `@stra/hmr` 不能依赖框架 (React/Vue)
- `@stra/semantic` 只能依赖 L0/L1/L4 包
- `@stra/ai-compiler` 的 Runtime Guardrail 是 AI 写入 tree 的唯一合法通道
