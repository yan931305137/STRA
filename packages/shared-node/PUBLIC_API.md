# @stra/shared-node — Public API

> Layer: L0 Foundation | Platform: Node.js only | Depends on: @stra/shared-core

## Public Exports (`import from '@stra/shared-node'`)

### Path Utilities (requires node:path)
- `toPosixPath(p: string): string`
- `normalizePath(p: string): string`
- `resolvePath(...segments: string[]): string`
- `joinPath(...segments: string[]): string`
- `getDirname(p: string): string`
- `getBasename(p: string, ext?: string): string`
- `getExtname(p: string): string`
- `isAbsolutePath(p: string): boolean`
- `isModuleFile(p: string): boolean`
- `matchGlob(pattern: string, subject: string): boolean`
- `pathPosix` (re-export of `node:path/posix`)
- `MODULE_EXTENSIONS` (const)
- `ModuleExtension` (type)

### Hashing Utilities (requires node:crypto)
- `hashContent(content: string | Buffer, length?: number): string`
- `hashPath(filePath: string, length?: number): string`
- `stableModuleId(relativePath: string): string`

## Internal (not exported)

None — this package is fully public.

## Platform Rules

- MUST ONLY be imported by Node.js packages
- Browser packages (e.g., @stra/client) MUST use @stra/shared-core instead
