# @stra/plugin — Public API

> Layer: L1 Runtime | Platform: Node.js | Depends on: @stra/types, @stra/shared-core

## Public Exports (`import from '@stra/plugin'`)

### Contract Versioning
- `PLUGIN_CONTRACT_VERSION` (const: currently `1`)
- `PluginContractVersion` (type)
- `PluginContractVersionError` (class — thrown on version mismatch)

### Hook Types
- `STRAPlugin` (interface — includes `contractVersion` field)
- `HookContext` (interface)
- `ResolveArgs`, `ResolveResult`
- `LoadArgs`, `LoadResult`
- `TransformArgs`, `TransformResult`
- `ServerContext`, `ConfigureServerArgs`
- `BuildStartArgs`, `BuildEndArgs`

### Container
- `PluginContainer` (class)
- `createPluginContainer(options: PluginContainerOptions): PluginContainer`
- `PluginContainerOptions` (interface)

### Definition Helpers
- `definePlugin(plugin: STRAPlugin): STRAPlugin` — auto-injects contract version
- `createPlugin(name: string): STRAPlugin` — minimal plugin factory
- `mergePlugins(name: string, ...plugins: Partial<STRAPlugin>[]): STRAPlugin`

## Internal (not exported)

- Implementation details of `PluginContainer` (private methods)

## Contract Versioning Rules

1. Every plugin MUST declare `contractVersion` (auto-set by `definePlugin`)
2. `PluginContainer` validates versions at registration time
3. Incompatible versions throw `PluginContractVersionError`
4. Bump `PLUGIN_CONTRACT_VERSION` on breaking changes to hook signatures
