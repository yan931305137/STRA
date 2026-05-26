/**
 * @stra/shared-node - Path utilities
 *
 * Cross-platform path normalization for STRA toolchain.
 * All internal paths use POSIX format (forward slashes).
 *
 * REQUIRES: node:path (Node.js only)
 */

import { posix, sep, isAbsolute, normalize, resolve, join, dirname, basename, extname } from 'node:path';

// -------------------------------------------------------
// Path normalization
// -------------------------------------------------------

/** Convert any OS path to POSIX (forward-slash) format. */
export function toPosixPath(p: string): string {
  return p.split(sep).join('/');
}

/** Normalize a path to POSIX, removing redundant segments. */
export function normalizePath(p: string): string {
  return toPosixPath(normalize(p));
}

/** Resolve a path to absolute POSIX form. */
export function resolvePath(...segments: string[]): string {
  return toPosixPath(resolve(...segments));
}

/** Join path segments into POSIX format. */
export function joinPath(...segments: string[]): string {
  return toPosixPath(join(...segments));
}

/** Get directory name (POSIX). */
export function getDirname(p: string): string {
  return toPosixPath(dirname(p));
}

/** Get base name with optional ext stripping. */
export function getBasename(p: string, ext?: string): string {
  return basename(p, ext);
}

/** Get extension (includes dot). */
export function getExtname(p: string): string {
  return extname(p);
}

/** Check if path is absolute (OS-aware). */
export function isAbsolutePath(p: string): boolean {
  return isAbsolute(p);
}

// -------------------------------------------------------
// Path matching
// -------------------------------------------------------

/** Supported extension list for module resolution. */
export const MODULE_EXTENSIONS = [
  '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx',
  '.cjs', '.cts',
] as const;

export type ModuleExtension = (typeof MODULE_EXTENSIONS)[number];

/** Check if a file path has a resolvable module extension. */
export function isModuleFile(p: string): boolean {
  const ext = getExtname(p);
  return (MODULE_EXTENSIONS as readonly string[]).includes(ext);
}

/** Simple glob-style pattern matching (only * wildcard). */
export function matchGlob(pattern: string, subject: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${regexStr}$`).test(subject);
}

// Re-export node:path/posix for convenience
export { posix as pathPosix };
