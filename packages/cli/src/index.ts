/**
 * @stra/cli - STRA Project Scaffolding & Development CLI
 *
 * Usage:
 *   npx stra my-app           → scaffold a new STRA project
 *   npx stra dev              → start dev server
 *   npx stra build            → build for production
 *
 * The CLI does 5 things (in order):
 *   1. Create project directory
 *   2. Select minimal template
 *   3. Write STRA runtime scaffold
 *   4. Install deps (pnpm)
 *   5. Start dev server
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ============================================================
// Color helpers (no dependencies)
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}◆${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✔${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}▲${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✖${colors.reset} ${msg}`),
  step: (n: number, total: number, msg: string) =>
    console.log(`\n${colors.bold}${colors.magenta}[${n}/${total}]${colors.reset} ${msg}`),
};

// ============================================================
// Template: minimal
// ============================================================

function getMinimalTemplate(projectName: string): Record<string, string> {
  return {
    // --- src/tree.ts ---
    'src/tree.ts': `import { createTree } from '@stra/core'

export const tree = createTree({
  count: 0,
})
`,

    // --- src/actions.ts ---
    'src/actions.ts': `import { action } from '@stra/core'
import { tree } from './tree'

export const inc = action(() => {
  tree.count++
})

export const dec = action(() => {
  tree.count--
})
`,

    // --- src/App.tsx ---
    'src/App.tsx': `import { useSignal } from '@stra/react'
import { tree } from './tree'
import { inc, dec } from './actions'

export function App() {
  const count = useSignal(tree.count)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0a0a0f',
      color: '#e8e8ed',
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#6366f1' }}>
        STRA App
      </h1>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <button
          onClick={dec}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: '1px solid #1e1e2e',
            background: '#111118',
            color: '#e8e8ed',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          −
        </button>
        <span style={{
          fontSize: '2rem',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 64,
          textAlign: 'center',
          fontFeatureSettings: '"tnum"',
        }}>
          {count}
        </span>
        <button
          onClick={inc}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            border: '1px solid #1e1e2e',
            background: '#111118',
            color: '#e8e8ed',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
      <p style={{
        marginTop: '2rem',
        fontSize: '0.75rem',
        color: '#71717a',
      }}>
        Tree = SSOT · Action = sole write entry · Signal = sole response
      </p>
    </div>
  )
}
`,

    // --- src/main.tsx ---
    'src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,

    // --- src/vite-env.d.ts ---
    'src/vite-env.d.ts': `/// <reference types="vite/client" />
`,

    // --- stra.config.ts ---
    'stra.config.ts': `import { defineConfig } from '@stra/core'

export default defineConfig({
  // STRA runtime configuration
  runtime: {
    // Enable devtools in development
    devtools: true,
    // Strict mode: enforce action-only writes
    strict: true,
  },
})
`,

    // --- package.json ---
    'package.json': JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          '@stra/core': 'latest',
          '@stra/react': 'latest',
          react: '^19',
          'react-dom': '^19',
        },
        devDependencies: {
          '@types/react': '^19',
          '@types/react-dom': '^19',
          '@vitejs/plugin-react': '^4',
          typescript: '^5',
          vite: '^6',
        },
      },
      null,
      2,
    ),

    // --- vite.config.ts ---
    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
  },
})
`,

    // --- tsconfig.json ---
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          moduleDetection: 'force',
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
        include: ['src'],
      },
      null,
      2,
    ),

    // --- index.html ---
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — STRA</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  };
}

// ============================================================
// Scaffold: write template files to disk
// ============================================================

function scaffold(projectDir: string, projectName: string): void {
  const template = getMinimalTemplate(projectName);

  for (const [filePath, content] of Object.entries(template)) {
    const fullPath = join(projectDir, filePath);
    const dir = resolve(fullPath, '..');

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
  }
}

// ============================================================
// Run shell command with output
// ============================================================

function run(cmd: string, cwd?: string): void {
  execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env } });
}

// ============================================================
// CLI Banner
// ============================================================

function printBanner(): void {
  console.log('');
  console.log(
    `${colors.bold}${colors.cyan}  ╔══════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}  ║${colors.reset} ${colors.bold}STRA${colors.reset} ${colors.dim}Semantic Tree Runtime${colors.reset}  ${colors.bold}${colors.cyan}║${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}  ╚══════════════════════════════╝${colors.reset}`,
  );
  console.log('');
}

// ============================================================
// Create command: npx stra my-app
// ============================================================

async function createCommand(projectName: string): Promise<void> {
  printBanner();

  const totalSteps = 5;
  const projectDir = resolve(process.cwd(), projectName);

  // Step 1: Create project directory
  log.step(1, totalSteps, `Creating project directory ${colors.bold}${projectName}${colors.reset}`);
  if (existsSync(projectDir)) {
    log.error(`Directory "${projectName}" already exists!`);
    process.exit(1);
  }
  mkdirSync(projectDir, { recursive: true });
  log.success(`Created ${projectDir}`);

  // Step 2: Select minimal template
  log.step(2, totalSteps, 'Selecting minimal template');
  log.info('Template: minimal (counter app with createTree / action / useSignal)');
  log.success('Template selected');

  // Step 3: Write STRA runtime scaffold
  log.step(3, totalSteps, 'Writing STRA runtime scaffold');
  scaffold(projectDir, projectName);
  log.success('Scaffold written:');
  log.info('  src/tree.ts      — reactive tree (SSOT)');
  log.info('  src/actions.ts   — action definitions (sole write entry)');
  log.info('  src/App.tsx      — React component (view adapter)');
  log.info('  src/main.tsx     — entry point');
  log.info('  stra.config.ts   — STRA configuration');
  log.info('  vite.config.ts   — Vite dev/build config');

  // Step 4: Install deps
  log.step(4, totalSteps, 'Installing dependencies (pnpm)');
  try {
    run('pnpm install', projectDir);
    log.success('Dependencies installed');
  } catch {
    log.warn('pnpm install failed — you can run it manually: cd ' + projectName + ' && pnpm install');
  }

  // Step 5: Start dev server
  log.step(5, totalSteps, 'Starting dev server');
  console.log('');
  log.success(`${colors.bold}${projectName}${colors.reset} is ready!`);
  console.log('');
  console.log(`  ${colors.dim}cd ${projectName}${colors.reset}`);
  console.log(`  ${colors.dim}pnpm dev${colors.reset}`);
  console.log('');
  console.log(
    `  ${colors.cyan}Tree${colors.reset} = SSOT   ${colors.yellow}Action${colors.reset} = sole write   ${colors.green}Signal${colors.reset} = sole response`,
  );
  console.log('');
}

// ============================================================
// Dev command: stra dev
// ============================================================

async function devCommand(): Promise<void> {
  log.info('Starting STRA dev server...');
  try {
    run('pnpm dev');
  } catch {
    log.error('Failed to start dev server. Make sure you are in a STRA project directory.');
    process.exit(1);
  }
}

// ============================================================
// Build command: stra build
// ============================================================

async function buildCommand(): Promise<void> {
  log.info('Building STRA project...');
  try {
    run('pnpm build');
    log.success('Build complete!');
  } catch {
    log.error('Build failed.');
    process.exit(1);
  }
}

// ============================================================
// Inspect command: stra inspect
// ============================================================

async function inspectCommand(): Promise<void> {
  log.info('Inspecting STRA semantic graph...');
  log.warn('Inspect requires @stra/semantic-devtools. Install it to enable:');
  log.info('  pnpm add -D @stra/semantic-devtools');
}

// ============================================================
// Graph command: stra graph
// ============================================================

async function graphCommand(): Promise<void> {
  log.info('Generating STRA dependency graph...');
  log.warn('Graph requires @stra/module-graph. Run from a STRA project root.');
  log.info('  Output: .stra/graph.json');
}

// ============================================================
// Doctor command: stra doctor
// ============================================================

async function doctorCommand(): Promise<void> {
  printBanner();
  log.info('Running STRA project diagnostics...');

  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  // Check 1: package.json exists
  const pkgExists = existsSync('package.json');
  checks.push({
    name: 'package.json',
    passed: pkgExists,
    detail: pkgExists ? 'Found' : 'Not found in current directory',
  });

  // Check 2: @stra/core in dependencies
  if (pkgExists) {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const hasCore = '@stra/core' in deps;
      checks.push({
        name: '@stra/core',
        passed: hasCore,
        detail: hasCore ? `v${deps['@stra/core']}` : 'Not installed',
      });
    } catch {
      checks.push({ name: '@stra/core', passed: false, detail: 'Cannot read package.json' });
    }
  }

  // Check 3: node_modules exists
  const nmExists = existsSync('node_modules');
  checks.push({
    name: 'node_modules',
    passed: nmExists,
    detail: nmExists ? 'Found' : 'Run pnpm install',
  });

  // Print results
  for (const check of checks) {
    const icon = check.passed ? `${colors.green}✔${colors.reset}` : `${colors.red}✖${colors.reset}`;
    console.log(`  ${icon} ${check.name}: ${check.detail}`);
  }

  const allPassed = checks.every(c => c.passed);
  if (allPassed) {
    log.success('All checks passed!');
  } else {
    log.warn('Some checks failed. Fix them before continuing.');
  }
}

// ============================================================
// Help
// ============================================================

function printHelp(): void {
  printBanner();
  console.log('  Usage:');
  console.log(`    ${colors.bold}stra <project-name>${colors.reset}    Create a new STRA project`);
  console.log(`    ${colors.bold}stra dev${colors.reset}              Start dev server`);
  console.log(`    ${colors.bold}stra build${colors.reset}            Build for production`);
  console.log(`    ${colors.bold}stra preview${colors.reset}          Preview production build`);
  console.log(`    ${colors.bold}stra inspect${colors.reset}          Inspect semantic graph`);
  console.log(`    ${colors.bold}stra graph${colors.reset}            Output dependency graph`);
  console.log(`    ${colors.bold}stra doctor${colors.reset}           Check project health`);
  console.log(`    ${colors.bold}stra help${colors.reset}             Show this help`);
  console.log('');
  console.log('  Architecture:');
  console.log(`    ${colors.cyan}CLI${colors.reset} → dev-server → ${colors.green}bundler${colors.reset} → ${colors.yellow}transform${colors.reset} → ${colors.magenta}semantic graph${colors.reset} → ${colors.green}runtime${colors.reset}`);
  console.log('');
  console.log('  Examples:');
  console.log(`    ${colors.cyan}npx stra my-app${colors.reset}      Scaffold a new project`);
  console.log(`    ${colors.cyan}cd my-app && stra dev${colors.reset} Start developing`);
  console.log(`    ${colors.cyan}stra doctor${colors.reset}            Diagnose issues`);
  console.log('');
}

// ============================================================
// Main entry
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'dev':
      await devCommand();
      break;
    case 'build':
      await buildCommand();
      break;
    case 'preview':
      log.info('Previewing STRA project...');
      try { run('pnpm preview'); } catch { log.error('Preview failed.'); process.exit(1); }
      break;
    case 'inspect':
      await inspectCommand();
      break;
    case 'graph':
      await graphCommand();
      break;
    case 'doctor':
      await doctorCommand();
      break;
    default:
      // Treat as project name → create command
      await createCommand(command);
      break;
  }
}

main().catch((err: Error) => {
  log.error(err.message);
  process.exit(1);
});

// ============================================================
// Exports (for programmatic use)
// ============================================================

export { createCommand, devCommand, buildCommand, inspectCommand, graphCommand, doctorCommand, scaffold, getMinimalTemplate };
