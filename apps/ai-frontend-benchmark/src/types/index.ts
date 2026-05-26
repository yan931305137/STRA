/**
 * AI Frontend Benchmark - Core Type Definitions
 *
 * Defines the entire data model for the benchmark pipeline:
 * Task → Prompt → Generated Code → Runner Result → Evaluation → Report
 */

// ─── Framework ───
export type Framework = 'react' | 'vue' | 'stra';

export const FRAMEWORKS: Framework[] = ['react', 'vue', 'stra'];

// ─── Task ───
export interface BenchmarkTask {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  editPrompt: string; // follow-up edit request for editability scoring
  complexity: 'low' | 'medium' | 'high';
  tags: string[];
}

// ─── Prompt Template ───
export interface PromptTemplate {
  framework: Framework;
  taskId: string;
  systemPrompt: string;
  userPrompt: string;
  editPrompt: string; // same task, but ask AI to modify
}

// ─── Generation Result ───
export interface GenerationResult {
  framework: Framework;
  taskId: string;
  code: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  generationTimeMs: number;
  error?: string;
}

export interface EditGenerationResult extends GenerationResult {
  editPromptTokens: number;
  editCompletionTokens: number;
  editTotalTokens: number;
  editGenerationTimeMs: number;
  editCode: string;
  editError?: string;
  filesChangedOriginal: number;
  filesChangedAfterEdit: number;
  structuralDisruption: number; // 0 = no disruption, 1 = full rewrite
}

// ─── Runner Result ───
export interface RunnerResult {
  framework: Framework;
  taskId: string;
  success: boolean;
  startedAt: number;
  finishedAt: number;
  startupTimeMs: number;
  consoleErrors: ConsoleError[];
  consoleWarnings: string[];
  screenshot?: Buffer;
  domSnapshot?: string;
  error?: string;
}

export interface ConsoleError {
  message: string;
  stack?: string;
  timestamp: number;
}

// ─── Evaluation Scores ───
export interface RuntimeScore {
  started: boolean;          // did the app start?
  noConsoleErrors: boolean;  // zero console errors?
  noWhiteScreen: boolean;    // non-empty DOM?
  startupTimeMs: number;     // time to interactive
  score: number;             // 0-100
}

export interface FunctionalScore {
  formPresent: boolean;      // has form elements?
  buttonPresent: boolean;    // has interactive buttons?
  inputFieldsPresent: boolean; // has input fields?
  tabSwitchWorks: boolean;   // can switch login/register tabs?
  formValidationWorks: boolean; // form validation present?
  stateChanges: boolean;     // state changes on interaction?
  score: number;             // 0-100
}

export interface StructuralScore {
  componentCount: number;
  avgComponentDepth: number;
  stateCentralized: boolean;
  noRedundantNesting: boolean;
  semanticStructure: boolean;   // proper semantic HTML?
  separationOfConcerns: boolean; // logic/view separated?
  score: number;                // 0-100
}

export interface TokenEfficiencyScore {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokensPerFeature: number;   // total / feature count
  codeLineCount: number;
  score: number;              // 0-100
}

export interface EditabilityScore {
  editPromptTokens: number;
  editCompletionTokens: number;
  editTotalTokens: number;
  editGenerationTimeMs: number;
  filesChangedOriginal: number;
  filesChangedAfterEdit: number;
  structuralDisruption: number; // 0 = no disruption, 1 = full rewrite
  score: number;                // 0-100
}

export interface ErrorRateScore {
  consoleErrorCount: number;
  runtimeErrorCount: number;
  structuralErrorRate: number;  // 0-1, higher = more structural errors
  score: number;                // 0-100
}

// ─── Full Evaluation ───
export interface FrameworkEvaluation {
  framework: Framework;
  taskId: string;
  runtime: RuntimeScore;
  functional: FunctionalScore;
  structural: StructuralScore;
  tokenEfficiency: TokenEfficiencyScore;
  editability: EditabilityScore;
  errorRate: ErrorRateScore;
  overallScore: number; // weighted total
}

// ─── Benchmark Report ───
export interface BenchmarkReport {
  id: string;
  timestamp: number;
  task: BenchmarkTask;
  evaluations: FrameworkEvaluation[];
  rankings: FrameworkRanking[];
  summary: string;
}

export interface FrameworkRanking {
  framework: Framework;
  overallScore: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
}

// ─── Scoring Weights ───
export interface ScoringWeights {
  runtime: number;
  functional: number;
  structural: number;
  editability: number;
  tokenEfficiency: number;
  errorRate: number;
}

export const SCORING_WEIGHTS: ScoringWeights = {
  runtime: 0.30,
  functional: 0.20,
  structural: 0.20,
  editability: 0.10,
  tokenEfficiency: 0.10,
  errorRate: 0.10,
};

// ─── Pipeline Config ───
export interface BenchmarkConfig {
  model: string;
  temperature: number;
  timeout: number;          // ms for runner
  headless: boolean;
  outputDir: string;
  parallelGeneration: boolean;
  maxRetries: number;
}
