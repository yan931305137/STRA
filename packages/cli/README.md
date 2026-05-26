# @stra/cli

**L4 Tooling** | STRA 项目脚手架 CLI。

## 快速开始

```bash
npx stra my-app
cd my-app
pnpm dev
```

## 命令

| 命令 | 说明 |
|------|------|
| `npx stra <name>` | 创建新 STRA 项目 |
| `npx stra dev` | 启动开发服务器 |
| `npx stra build` | 构建生产版本 |
| `npx stra inspect` | 检查语义图 |
| `npx stra graph` | 输出依赖图 |
| `npx stra doctor` | 诊断项目 |
| `npx stra help` | 显示帮助 |

## 生成结构

```
my-app/
├── src/
│   ├── tree.ts        # 语义树 (SSOT)
│   ├── actions.ts     # 动作 (sole write entry)
│   ├── App.tsx        # React 组件 (view adapter)
│   └── main.tsx       # 入口
├── stra.config.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 最小示例

```typescript
// src/tree.ts
import { createTree } from '@stra/core'
export const tree = createTree({ count: 0 })

// src/actions.ts
import { action } from '@stra/core'
import { tree } from './tree'
export const inc = action(() => { tree.count++ })

// src/App.tsx
import { useSignal } from '@stra/react'
import { tree } from './tree'
import { inc } from './actions'
export function App() {
  const count = useSignal(tree.count)
  return <button onClick={inc}>{count}</button>
}
```
