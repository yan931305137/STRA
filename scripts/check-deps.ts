#!/usr/bin/env npx tsx
/**
 * STRA Dependency Graph Check
 *
 * Validates the monorepo dependency graph for:
 * 1. Circular dependencies (any cycle is an error)
 * 2. Layer boundary violations (L0 ← L1 ← L2 ← L3 ← L4)
 * 3. Platform boundary violations (browser packages must not import node packages)
 *
 * Usage: npx tsx scripts/check-deps.ts
 * Exit code: 0 = pass, 1 = violations found
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// -------------------------------------------------------
// Layer definitions
// -------------------------------------------------------

const LAYER_MAP: Record<string, number> = {
  '@stra/shared-core': 0,
  '@stra/shared-node': 0,
  '@stra/shared-web': 0,
  '@stra/shared': 0,
  '@stra/types': 1,
  '@stra/core': 1,
  '@stra/plugin': 1,
  '@stra/react': 2,
  '@stra/renderer-core': 3,
  '@stra/renderer-html': 3,
  '@stra/dom': 3,
  '@stra/cli': 4,
  '@stra/transform': 4,
  '@stra/resolver': 4,
  '@stra/devtools': 4,
  '@stra/module-graph': 4,
  '@stra/hmr': 4,
  '@stra/client': 4,
  '@stra/bundler': 4,
  '@stra/dev-server': 4,
  '@stra/semantic': 5,
  '@stra/semantic-diff': 5,
  '@stra/causality': 5,
  '@stra/cache': 6,
  '@stra/optimizer': 6,
  '@stra/semantic-devtools': 7,
  '@stra/ai-compiler': 7,
  '@stra/time-travel': 7,
  '@stra/distributed-build': 8,
};

const LAYER_NAMES: Record<number, string> = {
  0: 'L0 Foundation',
  1: 'L1 Runtime',
  2: 'L2 UI Adapter',
  3: 'L3 Rendering',
  4: 'L4 Tooling',
  5: 'LS1 Semantic',
  6: 'LS2 Cache & Optimize',
  7: 'LS3 Dev & AI',
  8: 'LS4 Distribution',
};

// Browser-only packages that MUST NOT depend on Node.js packages
const BROWSER_PACKAGES = new Set([
  '@stra/client',
  '@stra/shared-web',
  '@stra/shared-core',
]);

// Node.js-only packages (contain node: imports)
const NODE_PACKAGES = new Set([
  '@stra/shared-node',
]);

// -------------------------------------------------------
// Graph building
// -------------------------------------------------------

interface PackageInfo {
  name: string;
  path: string;
  layer: number;
  deps: string[];
}

function discoverPackages(rootDir: string): PackageInfo[] {
  const packagesDir = join(rootDir, 'packages');
  const packages: PackageInfo[] = [];

  if (!existsSync(packagesDir)) {
    console.error(`❌ Packages directory not found: ${packagesDir}`);
    process.exit(1);
  }

  for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, dir.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const raw = readFileSync(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const name: string = pkg.name;
    if (!name || !name.startsWith('@stra/')) continue;

    const allDeps: string[] = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ].filter(d => d.startsWith('@stra/'));

    const layer = LAYER_MAP[name] ?? -1;

    packages.push({ name, path: dir.name, layer, deps: allDeps });
  }

  return packages;
}

// -------------------------------------------------------
// Check 1: Circular dependencies
// -------------------------------------------------------

function detectCycles(packages: PackageInfo[]): string[][] {
  const pkgMap = new Map(packages.map(p => [p.name, p]));
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      cycles.push(cycle);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const pkg = pkgMap.get(node);
    if (pkg) {
      for (const dep of pkg.deps) {
        dfs(dep);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const pkg of packages) {
    dfs(pkg.name);
  }

  return cycles;
}

// -------------------------------------------------------
// Check 2: Layer boundary violations
// -------------------------------------------------------

function detectLayerViolations(packages: PackageInfo[]): Array<{ from: string; to: string; fromLayer: number; toLayer: number }> {
  const violations: Array<{ from: string; to: string; fromLayer: number; toLayer: number }> = [];

  for (const pkg of packages) {
    if (pkg.layer < 0) continue; // unknown layer, skip
    for (const dep of pkg.deps) {
      const depLayer = LAYER_MAP[dep];
      if (depLayer === undefined || depLayer < 0) continue; // unknown dep, skip
      if (depLayer > pkg.layer) {
        violations.push({
          from: pkg.name,
          to: dep,
          fromLayer: pkg.layer,
          toLayer: depLayer,
        });
      }
    }
  }

  return violations;
}

// -------------------------------------------------------
// Check 3: Platform boundary violations
// -------------------------------------------------------

function detectPlatformViolations(packages: PackageInfo[]): Array<{ browserPkg: string; nodeDep: string }> {
  const violations: Array<{ browserPkg: string; nodeDep: string }> = [];

  function isNodeOnlyChain(pkgName: string, visited: Set<string>): boolean {
    if (NODE_PACKAGES.has(pkgName)) return true;
    if (visited.has(pkgName)) return false;
    visited.add(pkgName);

    const pkg = packages.find(p => p.name === pkgName);
    if (!pkg) return false;

    for (const dep of pkg.deps) {
      if (isNodeOnlyChain(dep, visited)) return true;
    }
    return false;
  }

  for (const pkg of packages) {
    if (!BROWSER_PACKAGES.has(pkg.name)) continue;
    for (const dep of pkg.deps) {
      const visited = new Set<string>();
      if (isNodeOnlyChain(dep, visited)) {
        violations.push({ browserPkg: pkg.name, nodeDep: dep });
      }
    }
  }

  return violations;
}

// -------------------------------------------------------
// Main
// -------------------------------------------------------

function main(): void {
  const rootDir = process.cwd();
  console.log('🔍 STRA Dependency Graph Check\n');

  const packages = discoverPackages(rootDir);
  console.log(`Found ${packages.length} packages\n`);

  let hasErrors = false;

  // Check 1: Cycles
  console.log('── Check 1: Circular Dependencies ──');
  const cycles = detectCycles(packages);
  if (cycles.length === 0) {
    console.log('✅ No circular dependencies found\n');
  } else {
    hasErrors = true;
    console.log(`❌ Found ${cycles.length} circular dependency cycle(s):\n`);
    for (const cycle of cycles) {
      console.log(`   ${cycle.join(' → ')}`);
    }
    console.log();
  }

  // Check 2: Layer violations
  console.log('── Check 2: Layer Boundary Violations ──');
  const layerViolations = detectLayerViolations(packages);
  if (layerViolations.length === 0) {
    console.log('✅ No layer boundary violations found\n');
  } else {
    hasErrors = true;
    console.log(`❌ Found ${layerViolations.length} layer violation(s):\n`);
    for (const v of layerViolations) {
      console.log(`   ${v.from} (${LAYER_NAMES[v.fromLayer]}) → ${v.to} (${LAYER_NAMES[v.toLayer]})`);
      console.log(`   Error: lower layer (${v.fromLayer}) depends on higher layer (${v.toLayer})`);
    }
    console.log();
  }

  // Check 3: Platform violations
  console.log('── Check 3: Platform Boundary Violations ──');
  const platformViolations = detectPlatformViolations(packages);
  if (platformViolations.length === 0) {
    console.log('✅ No platform boundary violations found\n');
  } else {
    hasErrors = true;
    console.log(`❌ Found ${platformViolations.length} platform violation(s):\n`);
    for (const v of platformViolations) {
      console.log(`   ${v.browserPkg} (browser) → ${v.nodeDep} (node-only)`);
    }
    console.log();
  }

  // Summary
  console.log('── Summary ──');
  if (hasErrors) {
    console.log('❌ Dependency graph check FAILED');
    process.exit(1);
  } else {
    console.log('✅ All dependency graph checks passed');
    process.exit(0);
  }
}

main();
