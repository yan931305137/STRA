/**
 * AI Frontend Benchmark - Main Entry Point & Pipeline Orchestrator
 *
 * Strategy: Per-framework incremental pipeline with checkpoint saves.
 * Each framework goes through the full pipeline independently.
 * Results are saved after each step, so a crash loses no completed work.
 *
 * Usage:
 *   npx tsx src/index.ts                # Full benchmark (incremental)
 *   npx tsx src/index.ts --sample       # Use pre-built samples (no LLM)
 *   npx tsx src/index.ts --resume       # Resume from last checkpoint
 *   npx tsx src/index.ts --help         # Show help
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tasks } from './tasks/index.js';
import { createAllPromptTemplates } from './prompts/index.js';
import { generateCode, generateEditCode } from './generators/index.js';
import { runGeneratedCode, runFunctionalTests } from './runners/index.js';
import { evaluateFramework } from './evaluators/index.js';
import { generateRankings, generateSummary, saveJsonReport, saveHtmlReport } from './reports/index.js';
import type { BenchmarkConfig, BenchmarkReport, Framework, GenerationResult, EditGenerationResult, BenchmarkTask, FrameworkEvaluation } from './types/index.js';
import { SCORING_WEIGHTS } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCORING_WEIGHTS_LOCAL = SCORING_WEIGHTS;

const FRAMEWORKS: Framework[] = ['react', 'vue', 'stra'];

const DEFAULT_CONFIG: BenchmarkConfig = {
  model: 'doubao-seed-2-0-pro-260215',
  temperature: 0.2,
  timeout: 30000,
  headless: true,
  outputDir: path.join(process.cwd(), 'benchmark-output'),
  parallelGeneration: false,
  maxRetries: 2,
};

// ─── Checkpoint System ───

interface FrameworkCheckpoint {
  framework: Framework;
  taskId: string;
  status: 'pending' | 'generating' | 'generated' | 'editing' | 'edited' | 'running' | 'ran' | 'testing' | 'tested' | 'evaluated' | 'failed';
  generation?: GenerationResult;
  edit?: EditGenerationResult;
  runResult?: any;
  funcResult?: any;
  evaluation?: FrameworkEvaluation;
  error?: string;
  updatedAt: number;
}

interface TaskCheckpoint {
  taskId: string;
  frameworks: Record<string, FrameworkCheckpoint>;
  startedAt: number;
}

function checkpointPath(outputDir: string, taskId: string): string {
  return path.join(outputDir, 'checkpoints', `${taskId}.json`);
}

function loadCheckpoint(outputDir: string, taskId: string): TaskCheckpoint | null {
  const cpFile = checkpointPath(outputDir, taskId);
  if (fs.existsSync(cpFile)) {
    try {
      return JSON.parse(fs.readFileSync(cpFile, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveCheckpoint(outputDir: string, cp: TaskCheckpoint): void {
  const cpDir = path.join(outputDir, 'checkpoints');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(checkpointPath(outputDir, cp.taskId), JSON.stringify(cp, null, 2), 'utf-8');
}

function initCheckpoint(taskId: string): TaskCheckpoint {
  const cp: TaskCheckpoint = {
    taskId,
    frameworks: {},
    startedAt: Date.now(),
  };
  for (const fw of FRAMEWORKS) {
    cp.frameworks[fw] = {
      framework: fw,
      taskId,
      status: 'pending',
      updatedAt: Date.now(),
    };
  }
  return cp;
}

// ─── Logging ───

function logStep(step: string, detail?: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${step}${detail ? ` — ${detail}` : ''}`);
}

// ─── HTML Completeness Check ───

function isHtmlComplete(code: string): boolean {
  const trimmed = code.trim().toLowerCase();
  return trimmed.includes('</html>');
}

// ─── Sample Code Loader ───

function loadSampleCode(task: BenchmarkTask): Map<Framework, GenerationResult> {
  const results = new Map<Framework, GenerationResult>();
  const samplesDir = path.join(__dirname, 'samples', task.id);

  for (const fw of FRAMEWORKS) {
    const filePath = path.join(samplesDir, `${fw}.html`);
    if (fs.existsSync(filePath)) {
      const code = fs.readFileSync(filePath, 'utf-8');
      results.set(fw, {
        framework: fw,
        taskId: task.id,
        code,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        generationTimeMs: 0,
        error: undefined,
      });
      logStep('SAMPLE', `  ✓ ${fw.toUpperCase()} loaded (${code.split('\n').length} lines)`);
    } else {
      results.set(fw, {
        framework: fw,
        taskId: task.id,
        code: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        generationTimeMs: 0,
        error: `Sample not found: ${filePath}`,
      });
      logStep('SAMPLE', `  ✗ ${fw.toUpperCase()} sample not found`);
    }
  }

  return results;
}

// ─── Per-Framework Pipeline (Incremental) ───

async function runFrameworkPipeline(
  task: BenchmarkTask,
  framework: Framework,
  cp: TaskCheckpoint,
  config: BenchmarkConfig,
  useSamples: boolean
): Promise<void> {
  const fwCp = cp.frameworks[framework];
  const templates = createAllPromptTemplates(task);
  const template = templates.find(t => t.framework === framework);
  if (!template) {
    fwCp.status = 'failed';
    fwCp.error = 'No prompt template found';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);
    return;
  }

  // ── Step 1: Generate ──
  if (fwCp.status === 'pending' || fwCp.status === 'failed') {
    fwCp.status = 'generating';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);

    try {
      let genResult: GenerationResult;
      if (useSamples) {
        const samplesDir = path.join(__dirname, 'samples', task.id);
        const filePath = path.join(samplesDir, `${framework}.html`);
        if (fs.existsSync(filePath)) {
          const code = fs.readFileSync(filePath, 'utf-8');
          genResult = {
            framework, taskId: task.id, code,
            promptTokens: 0, completionTokens: 0, totalTokens: 0,
            generationTimeMs: 0, error: undefined,
          };
        } else {
          throw new Error(`Sample not found: ${filePath}`);
        }
      } else {
        logStep('GENERATE', `→ ${framework.toUpperCase()}...`);
        genResult = await generateCode(template, config);
      }

      fwCp.generation = genResult;
      if (genResult.error) fwCp.error = genResult.error;

      // Validate generated HTML completeness
      if (genResult.code && !isHtmlComplete(genResult.code)) {
        const truncationWarning = 'Generated HTML appears truncated (missing </html> closing tag)';
        logStep('WARN', `${framework.toUpperCase()}: ${truncationWarning}`);
        if (!genResult.error) {
          genResult.error = truncationWarning;
          fwCp.error = truncationWarning;
        }
      }

      fwCp.status = genResult.error ? 'failed' : 'generated';
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);

      // Save generated code file immediately
      if (genResult.code) {
        const codeDir = path.join(config.outputDir, 'generated', task.id);
        fs.mkdirSync(codeDir, { recursive: true });
        fs.writeFileSync(path.join(codeDir, `${framework}.html`), genResult.code, 'utf-8');
      }

      if (genResult.error) {
        logStep('GENERATE', `✗ ${framework.toUpperCase()} failed: ${genResult.error}`);
        return; // Stop pipeline for this framework
      } else {
        logStep('GENERATE', `✓ ${framework.toUpperCase()} (${genResult.code.split('\n').length} lines, ~${genResult.totalTokens} tokens)`);
      }
    } catch (err: any) {
      fwCp.status = 'failed';
      fwCp.error = err.message;
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);
      logStep('GENERATE', `✗ ${framework.toUpperCase()} error: ${err.message}`);
      return;
    }
  } else {
    logStep('GENERATE', `⊘ ${framework.toUpperCase()} already generated (status: ${fwCp.status})`);
  }

  // ── Step 2: Generate Edit (skip if using samples) ──
  if (fwCp.status === 'generated' && !useSamples) {
    fwCp.status = 'editing';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);

    try {
      logStep('EDIT', `→ ${framework.toUpperCase()}...`);
      const editResult = await generateEditCode(template, fwCp.generation!.code, config);
      fwCp.edit = editResult;
      fwCp.status = editResult.editError ? 'failed' : 'edited';
      if (editResult.editError) fwCp.error = editResult.editError;
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);

      if (editResult.editError) {
        logStep('EDIT', `✗ ${framework.toUpperCase()} failed: ${editResult.editError}`);
      } else {
        logStep('EDIT', `✓ ${framework.toUpperCase()} (disruption: ${(editResult.structuralDisruption * 100).toFixed(0)}%)`);
      }
    } catch (err: any) {
      fwCp.status = 'edited'; // Continue without edit data
      fwCp.error = err.message;
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);
      logStep('EDIT', `✗ ${framework.toUpperCase()} error: ${err.message}, continuing...`);
    }
  } else if (fwCp.status === 'generated' && useSamples) {
    fwCp.status = 'edited';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);
    logStep('EDIT', `⊘ ${framework.toUpperCase()} skipped (sample mode)`);
  } else if (fwCp.status !== 'edited' && fwCp.status !== 'ran' && fwCp.status !== 'tested' && fwCp.status !== 'evaluated') {
    // Already past this step
  }

  // ── Step 3: Run with Playwright ──
  if (fwCp.status === 'edited') {
    fwCp.status = 'running';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);

    try {
      logStep('RUN', `→ ${framework.toUpperCase()}...`);
      const runResult = await runGeneratedCode(framework, task.id, fwCp.generation!.code, config);
      fwCp.runResult = runResult;
      fwCp.status = 'ran';
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);

      if (runResult.success) {
        logStep('RUN', `✓ ${framework.toUpperCase()} started in ${runResult.startupTimeMs}ms (${runResult.consoleErrors.length} errors)`);
      } else {
        logStep('RUN', `✗ ${framework.toUpperCase()} failed: ${runResult.error}`);
      }
    } catch (err: any) {
      fwCp.status = 'ran'; // Continue with fallback run result
      fwCp.error = err.message;
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);
      logStep('RUN', `✗ ${framework.toUpperCase()} error: ${err.message}, continuing...`);
    }
  } else if (fwCp.status !== 'ran' && fwCp.status !== 'testing' && fwCp.status !== 'tested' && fwCp.status !== 'evaluated') {
    // Already past this step
  }

  // ── Step 4: Functional Tests ──
  if (fwCp.status === 'ran') {
    fwCp.status = 'testing';
    fwCp.updatedAt = Date.now();
    saveCheckpoint(config.outputDir, cp);

    try {
      logStep('FUNC', `→ ${framework.toUpperCase()}...`);
      const funcResult = await runFunctionalTests(framework, task.id, fwCp.generation!.code, config);
      fwCp.funcResult = funcResult;
      fwCp.status = 'tested';
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);

      const passCount = Object.values(funcResult).filter(Boolean).length;
      logStep('FUNC', `✓ ${framework.toUpperCase()} passed ${passCount}/6 checks`);
    } catch (err: any) {
      fwCp.status = 'tested'; // Continue with fallback func result
      fwCp.error = err.message;
      fwCp.updatedAt = Date.now();
      saveCheckpoint(config.outputDir, cp);
      logStep('FUNC', `✗ ${framework.toUpperCase()} error: ${err.message}`);
    }
  }

  // ── Step 5: Evaluate ──
  if (fwCp.status === 'tested') {
    fwCp.status = 'evaluated';
    fwCp.updatedAt = Date.now();

    // Build fallback results for missing steps
    const fallbackRunResult = {
      framework, taskId: task.id,
      success: false, startedAt: Date.now(), finishedAt: Date.now(),
      startupTimeMs: 0, consoleErrors: [], consoleWarnings: [],
      error: fwCp.runResult?.error || 'Not run',
    };

    const fallbackEditResult: EditGenerationResult = {
      ...fwCp.generation!,
      editPromptTokens: 0, editCompletionTokens: 0, editTotalTokens: 0,
      editGenerationTimeMs: 0, editCode: '',
      filesChangedOriginal: 1, filesChangedAfterEdit: 1,
      structuralDisruption: 1,
    };

    const fallbackFuncResult = {
      formPresent: false, buttonPresent: false, inputFieldsPresent: false,
      tabSwitchWorks: false, formValidationWorks: false, stateChanges: false,
    };

    fwCp.evaluation = evaluateFramework(
      framework,
      task.id,
      fwCp.generation!,
      fwCp.edit || fallbackEditResult,
      fwCp.runResult || fallbackRunResult,
      fwCp.funcResult || fallbackFuncResult,
      SCORING_WEIGHTS_LOCAL
    );

    saveCheckpoint(config.outputDir, cp);
    logStep('EVALUATE', `✓ ${framework.toUpperCase()} = ${fwCp.evaluation.overallScore.toFixed(1)} points`);
  }

  logStep('PIPELINE', `${framework.toUpperCase()} pipeline complete (status: ${fwCp.status})`);
}

// ─── Main Pipeline ───

async function runBenchmark(config: BenchmarkConfig, useSamples: boolean = false, resume: boolean = false): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('  STRA AI Frontend Benchmark');
  console.log('  Model: ' + (useSamples ? 'SAMPLES (no LLM)' : config.model));
  console.log('  Mode: ' + (resume ? 'RESUME' : useSamples ? 'SAMPLE' : 'FULL'));
  console.log('═'.repeat(60) + '\n');

  fs.mkdirSync(config.outputDir, { recursive: true });

  for (const task of tasks) {
    logStep('TASK', `Starting: ${task.title} (${task.id})`);

    // Load or init checkpoint
    let cp: TaskCheckpoint;
    if (resume) {
      const existing = loadCheckpoint(config.outputDir, task.id);
      if (existing) {
        cp = existing;
        logStep('RESUME', `Resuming from checkpoint (frameworks: ${Object.values(cp.frameworks).map(f => `${f.framework}=${f.status}`).join(', ')})`);
      } else {
        cp = initCheckpoint(task.id);
        logStep('RESUME', 'No checkpoint found, starting fresh');
      }
    } else {
      cp = initCheckpoint(task.id);
    }

    // Run each framework's pipeline independently
    for (const framework of FRAMEWORKS) {
      const fwCp = cp.frameworks[framework];

      // Skip if already evaluated
      if (fwCp.status === 'evaluated') {
        logStep('SKIP', `${framework.toUpperCase()} already evaluated (score: ${fwCp.evaluation?.overallScore?.toFixed(1)})`);
        continue;
      }

      await runFrameworkPipeline(task, framework, cp, config, useSamples);
    }

    // ── Generate Final Report ──
    const evaluations: FrameworkEvaluation[] = [];
    for (const fw of FRAMEWORKS) {
      const fwCp = cp.frameworks[fw];
      if (fwCp.evaluation) {
        evaluations.push(fwCp.evaluation);
      }
    }

    if (evaluations.length === 0) {
      logStep('REPORT', 'No evaluations available, skipping report generation');
      continue;
    }

    const rankings = generateRankings(evaluations);
    const summary = generateSummary(evaluations, rankings);
    console.log(summary);

    const report: BenchmarkReport = {
      id: `${task.id}-${Date.now()}`,
      timestamp: Date.now(),
      task,
      evaluations,
      rankings,
      summary,
    };

    const jsonPath = saveJsonReport(report, config.outputDir);
    const htmlPath = saveHtmlReport(report, config.outputDir);
    logStep('REPORT', `JSON: ${jsonPath}`);
    logStep('REPORT', `HTML: ${htmlPath}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Benchmark Complete!');
  console.log('═'.repeat(60) + '\n');
}

// ─── CLI Argument Parsing ───

function parseArgs(): { config: BenchmarkConfig; useSamples: boolean; resume: boolean } {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  let useSamples = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sample':
        useSamples = true;
        break;
      case '--resume':
        resume = true;
        break;
      case '--model':
        config.model = args[++i];
        break;
      case '--temperature':
        config.temperature = parseFloat(args[++i]);
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i], 10);
        break;
      case '--no-headless':
        config.headless = false;
        break;
      case '--output':
        config.outputDir = args[++i];
        break;
      case '--help':
        console.log(`
STRA AI Frontend Benchmark

Usage:
  npx tsx src/index.ts [options]

Options:
  --sample         Use pre-built sample code (no LLM calls)
  --resume         Resume from last checkpoint (skip completed steps)
  --model <id>     LLM model to use (default: ${DEFAULT_CONFIG.model})
  --temperature <n> Temperature for generation (default: ${DEFAULT_CONFIG.temperature})
  --timeout <ms>   Runner timeout in ms (default: ${DEFAULT_CONFIG.timeout})
  --no-headless    Show browser windows during testing
  --output <dir>   Output directory (default: ./benchmark-output)
  --help           Show this help

Strategy:
  Each framework runs its full pipeline independently (generate→edit→run→test→evaluate).
  Results are saved after each step. If the process crashes, use --resume to continue.
`);
        process.exit(0);
    }
  }

  return { config, useSamples, resume };
}

// ─── Entry Point ───

async function main() {
  const { config, useSamples, resume } = parseArgs();
  await runBenchmark(config, useSamples, resume);
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
