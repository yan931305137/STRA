/**
 * @stra/transform - File type detection
 */

import { extname } from 'node:path';
import type { ModuleType } from './types';

const EXT_TO_TYPE: Record<string, ModuleType> = {
  '.mjs': 'js',
  '.cjs': 'js',
  '.js': 'js',
  '.mts': 'ts',
  '.cts': 'ts',
  '.ts': 'ts',
  '.jsx': 'jsx',
  '.tsx': 'tsx',
  '.css': 'css',
  '.json': 'json',
  '.vue': 'sfc',
  '.svelte': 'sfc',
};

/** Detect module type from file extension. */
export function detectModuleType(id: string): ModuleType {
  const ext = extname(id).toLowerCase();
  return EXT_TO_TYPE[ext] ?? 'asset';
}

/** Check if a file type requires transformation. */
export function needsTransform(moduleType: ModuleType): boolean {
  return moduleType === 'ts' || moduleType === 'tsx' || moduleType === 'jsx'
    || moduleType === 'sfc' || moduleType === 'css';
}

/** Check if the file is a script type (JS/TS/JSX/TSX). */
export function isScriptType(moduleType: ModuleType): boolean {
  return moduleType === 'js' || moduleType === 'ts'
    || moduleType === 'jsx' || moduleType === 'tsx';
}
