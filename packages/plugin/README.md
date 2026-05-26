# @stra/plugin

**L1 Runtime** | Plugin system — versioned contract, hooks, and execution pipeline.

## Install

```bash
pnpm add @stra/plugin
```

## Exports

- **Contract Versioning** — `PLUGIN_CONTRACT_VERSION`, `PluginContractVersionError`
- **Hook Types** — `STRAPlugin`, `HookContext`, resolve/load/transform/server/build hooks
- **Container** — `PluginContainer`, `createPluginContainer()`
- **Helpers** — `definePlugin()`, `createPlugin()`, `mergePlugins()`

## Contract Versioning

Every plugin MUST declare `contractVersion` (auto-set by `definePlugin`). Incompatible versions throw at registration time.

See [PUBLIC_API.md](./PUBLIC_API.md) for the full API reference.
