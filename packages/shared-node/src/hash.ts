/**
 * @stra/shared-node - Content hashing
 *
 * Deterministic hashing for cache-busting and content integrity.
 *
 * REQUIRES: node:crypto (Node.js only)
 */

import { createHash } from 'node:crypto';

/** Hash algorithm used throughout STRA. */
const HASH_ALGO = 'md5';
const HASH_LENGTH = 8;

/** Compute a short content hash (8-char hex by default). */
export function hashContent(content: string | Buffer, length: number = HASH_LENGTH): string {
  return createHash(HASH_ALGO)
    .update(content)
    .digest('hex')
    .slice(0, length);
}

/** Compute a content hash for a file path (useful for ESM cache keys). */
export function hashPath(filePath: string, length?: number): string {
  return hashContent(filePath, length);
}

/** Generate a stable module ID from file path (relative + hash). */
export function stableModuleId(relativePath: string): string {
  const hash = hashContent(relativePath, 6);
  // Strip leading dots/slashes and replace / with _
  const cleaned = relativePath.replace(/^[\./]+/, '').replace(/\//g, '_');
  return `${cleaned}_${hash}`;
}
