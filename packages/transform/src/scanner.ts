/**
 * @stra/transform - Import scanner
 *
 * Extracts import/export specifiers from JS/TS source code.
 * Uses regex-based scanning for zero-dependency operation.
 * For production accuracy, use a full parser plugin.
 */

/** Match static import specifiers: import ... from '...' */
const IMPORT_RE = /import\s+(?:type\s+)?(?:[\w{},\s*]*\s+from\s+)?['"]([^'"]+)['"]/g;

/** Match dynamic import specifiers: import('...') */
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Match export ... from specifiers */
const EXPORT_FROM_RE = /export\s+(?:type\s+)?(?:[\w{},\s*]*\s+from\s+)?['"]([^'"]+)['"]/g;

/** Scan source code for import/export dependencies. */
export function scanImports(code: string): string[] {
  const deps = new Set<string>();

  let match: RegExpExecArray | null;

  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(code)) !== null) {
    deps.add(match[1]);
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_RE.exec(code)) !== null) {
    deps.add(match[1]);
  }

  EXPORT_FROM_RE.lastIndex = 0;
  while ((match = EXPORT_FROM_RE.exec(code)) !== null) {
    deps.add(match[1]);
  }

  return Array.from(deps);
}
