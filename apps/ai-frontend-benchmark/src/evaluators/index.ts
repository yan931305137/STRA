/**
 * Multi-Dimension Auto-Scoring Evaluator
 *
 * Evaluates generated code across 6 dimensions:
 * 1. Runtime Score (0.30) — does it run?
 * 2. Functional Score (0.20) — does it work?
 * 3. Structural Score (0.20) — is it well-structured?
 * 4. Token Efficiency (0.10) — how efficient?
 * 5. Editability (0.10) — how easy to modify?
 * 6. Error Rate (0.10) — how many errors?
 */
import type {
  Framework,
  GenerationResult,
  EditGenerationResult,
  RunnerResult,
  FrameworkEvaluation,
  RuntimeScore,
  FunctionalScore,
  StructuralScore,
  TokenEfficiencyScore,
  EditabilityScore,
  ErrorRateScore,
  ScoringWeights,
} from '../types/index.js';

// ─── 1. Runtime Score ───
export function evaluateRuntime(runnerResult: RunnerResult): RuntimeScore {
  let score = 0;
  const started = runnerResult.success;
  const noConsoleErrors = runnerResult.consoleErrors.length === 0;
  const noWhiteScreen = runnerResult.success && (runnerResult.domSnapshot?.length ?? 0) > 50;

  if (started) score += 40;
  if (noConsoleErrors) score += 30;
  if (noWhiteScreen) score += 30;

  // Penalty for slow startup
  if (runnerResult.startupTimeMs > 10000) score -= 10;
  if (runnerResult.startupTimeMs > 30000) score -= 20;

  return {
    started,
    noConsoleErrors,
    noWhiteScreen,
    startupTimeMs: runnerResult.startupTimeMs,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── 2. Functional Score ───
export function evaluateFunctional(
  functionalTestResult: {
    formPresent: boolean;
    buttonPresent: boolean;
    inputFieldsPresent: boolean;
    tabSwitchWorks: boolean;
    formValidationWorks: boolean;
    stateChanges: boolean;
  }
): FunctionalScore {
  let score = 0;
  const { formPresent, buttonPresent, inputFieldsPresent, tabSwitchWorks, formValidationWorks, stateChanges } = functionalTestResult;

  if (formPresent) score += 15;
  if (buttonPresent) score += 15;
  if (inputFieldsPresent) score += 15;
  if (tabSwitchWorks) score += 25;
  if (formValidationWorks) score += 20;
  if (stateChanges) score += 10;

  return {
    formPresent,
    buttonPresent,
    inputFieldsPresent,
    tabSwitchWorks,
    formValidationWorks,
    stateChanges,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── 3. Structural Score ───
export function evaluateStructural(code: string, framework: Framework): StructuralScore {
  let score = 0;

  // Component count analysis
  const componentCount = countComponents(code, framework);
  const avgComponentDepth = estimateComponentDepth(code, framework);

  // State centralization check
  const stateCentralized = checkStateCentralization(code, framework);

  // No redundant nesting
  const noRedundantNesting = !hasRedundantNesting(code);

  // Semantic structure
  const semanticStructure = checkSemanticStructure(code);

  // Separation of concerns
  const separationOfConcerns = checkSeparationOfConcerns(code, framework);

  // Score calculation
  if (componentCount >= 2 && componentCount <= 15) score += 20; // reasonable count
  else if (componentCount > 15) score += 5; // too many
  else score += 10; // too few

  if (avgComponentDepth <= 4) score += 15; // shallow depth is good
  else if (avgComponentDepth <= 6) score += 10;
  else score += 5;

  if (stateCentralized) score += 25; // biggest differentiator for STRA
  if (noRedundantNesting) score += 15;
  if (semanticStructure) score += 15;
  if (separationOfConcerns) score += 10;

  return {
    componentCount,
    avgComponentDepth,
    stateCentralized,
    noRedundantNesting,
    semanticStructure,
    separationOfConcerns,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── 4. Token Efficiency Score ───
export function evaluateTokenEfficiency(genResult: GenerationResult): TokenEfficiencyScore {
  const { totalTokens, completionTokens, promptTokens } = genResult;
  const codeLineCount = genResult.code.split('\n').length;

  // Feature count for this task (login/register page has ~7 features)
  const featureCount = 7;
  const tokensPerFeature = totalTokens / featureCount;

  let score = 0;

  // Fewer tokens = better (but not too few, which means incomplete)
  if (completionTokens > 0 && completionTokens < 5000) score += 30;
  else if (completionTokens < 8000) score += 20;
  else score += 10;

  // Tokens per feature (lower is better)
  if (tokensPerFeature < 500) score += 30;
  else if (tokensPerFeature < 1000) score += 20;
  else score += 10;

  // Code line count (reasonable size)
  if (codeLineCount > 50 && codeLineCount < 500) score += 20;
  else if (codeLineCount < 1000) score += 10;
  else score += 5;

  // Prompt efficiency
  if (promptTokens < 3000) score += 20;
  else if (promptTokens < 5000) score += 10;
  else score += 5;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerFeature: Math.round(tokensPerFeature),
    codeLineCount,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── 5. Editability Score ───
export function evaluateEditability(editResult: EditGenerationResult): EditabilityScore {
  let score = 0;

  const { editTotalTokens, editGenerationTimeMs, filesChangedAfterEdit, structuralDisruption } = editResult;

  // Lower structural disruption = better editability
  if (structuralDisruption < 0.3) score += 40; // minimal changes
  else if (structuralDisruption < 0.5) score += 25;
  else if (structuralDisruption < 0.7) score += 15;
  else score += 5;

  // Lower edit token cost = better
  if (editTotalTokens < 3000) score += 25;
  else if (editTotalTokens < 6000) score += 15;
  else score += 5;

  // Faster edit generation = better
  if (editGenerationTimeMs < 10000) score += 15;
  else if (editGenerationTimeMs < 30000) score += 10;
  else score += 5;

  // Single file change = simpler (for this benchmark, always 1)
  if (filesChangedAfterEdit <= 1) score += 10;
  else score += 5;

  // Edit didn't cause errors
  if (!editResult.editError) score += 10;
  else score += 0;

  return {
    editPromptTokens: editResult.editPromptTokens,
    editCompletionTokens: editResult.editCompletionTokens,
    editTotalTokens: editResult.editTotalTokens,
    editGenerationTimeMs: editResult.editGenerationTimeMs,
    filesChangedOriginal: editResult.filesChangedOriginal,
    filesChangedAfterEdit: editResult.filesChangedAfterEdit,
    structuralDisruption,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── 6. Error Rate Score ───
export function evaluateErrorRate(
  runnerResult: RunnerResult,
  code: string
): ErrorRateScore {
  const consoleErrorCount = runnerResult.consoleErrors.length;
  const runtimeErrorCount = runnerResult.consoleErrors.filter(
    (e) => e.message.includes('Error') || e.message.includes('Uncaught')
  ).length;

  // Structural error detection — patterns that indicate AI structural mistakes
  const structuralErrors = detectStructuralErrors(code);
  const structuralErrorRate = structuralErrors.length > 0
    ? Math.min(1, structuralErrors.length / 5)
    : 0;

  let score = 100;

  // Deduct for console errors
  score -= Math.min(40, consoleErrorCount * 10);

  // Deduct for runtime errors
  score -= Math.min(30, runtimeErrorCount * 15);

  // Deduct for structural errors
  score -= Math.min(30, Math.round(structuralErrorRate * 30));

  return {
    consoleErrorCount,
    runtimeErrorCount,
    structuralErrorRate,
    score: Math.max(0, score),
  };
}

// ─── Composite Evaluation ───
export function evaluateFramework(
  framework: Framework,
  taskId: string,
  genResult: GenerationResult,
  editResult: EditGenerationResult,
  runnerResult: RunnerResult,
  functionalTestResult: {
    formPresent: boolean;
    buttonPresent: boolean;
    inputFieldsPresent: boolean;
    tabSwitchWorks: boolean;
    formValidationWorks: boolean;
    stateChanges: boolean;
  },
  weights: ScoringWeights
): FrameworkEvaluation {
  const runtime = evaluateRuntime(runnerResult);
  const functional = evaluateFunctional(functionalTestResult);
  const structural = evaluateStructural(genResult.code, framework);
  const tokenEfficiency = evaluateTokenEfficiency(genResult);
  const editability = evaluateEditability(editResult);
  const errorRate = evaluateErrorRate(runnerResult, genResult.code);

  const overallScore =
    weights.runtime * runtime.score +
    weights.functional * functional.score +
    weights.structural * structural.score +
    weights.editability * editability.score +
    weights.tokenEfficiency * tokenEfficiency.score +
    weights.errorRate * errorRate.score;

  return {
    framework,
    taskId,
    runtime,
    functional,
    structural,
    tokenEfficiency,
    editability,
    errorRate,
    overallScore: Math.round(overallScore * 100) / 100,
  };
}

// ─── Helper: Component Detection ───
function countComponents(code: string, framework: Framework): number {
  switch (framework) {
    case 'react': {
      const funcCompMatch = code.match(/(?:function|const)\s+[A-Z]\w+\s*(?:=|\()/g);
      return funcCompMatch?.length ?? 0;
    }
    case 'vue': {
      const vueCompMatch = code.match(/app\.component\(|defineComponent|<\w+-\w+/g);
      return vueCompMatch?.length ?? 0;
    }
    case 'stra': {
      const strNodeMatch = code.match(/createTree|createNode|{\s*id:\s*['"]/g);
      return strNodeMatch?.length ?? 0;
    }
  }
}

function estimateComponentDepth(code: string, framework: Framework): number {
  // Simple heuristic: max nesting of components/elements
  const lines = code.split('\n');
  let maxDepth = 0;
  let currentDepth = 0;

  for (const line of lines) {
    const opens = (line.match(/[<{]/g) || []).length;
    const closes = (line.match(/[>}]/g) || []).length;
    currentDepth += opens - closes;
    if (currentDepth > maxDepth) maxDepth = currentDepth;
  }

  return Math.round(maxDepth / 2); // approximate depth
}

function checkStateCentralization(code: string, framework: Framework): boolean {
  switch (framework) {
    case 'react': {
      // React: check if useState is scattered across many components
      const useStateCount = (code.match(/useState/g) || []).length;
      const componentCount = countComponents(code, framework);
      if (componentCount === 0) return false;
      return useStateCount / componentCount <= 1.5; // avg ≤ 1.5 useState per component = somewhat centralized
    }
    case 'vue': {
      const refCount = (code.match(/\bref\(/g) || []).length;
      const reactiveCount = (code.match(/\breactive\(/g) || []).length;
      return refCount + reactiveCount <= 5; // few reactive sources
    }
    case 'stra': {
      // STRA: check if state is in the tree (createTree + dispatchAction)
      const hasCreateTree = code.includes('createTree');
      const hasDispatchAction = code.includes('dispatchAction');
      const hasNoDirectMutate = !code.match(/tree\.\w+\s*=/);
      return hasCreateTree && hasDispatchAction && hasNoDirectMutate;
    }
  }
}

function hasRedundantNesting(code: string): boolean {
  // Check for deeply nested divs (>6 levels)
  const divNesting = code.match(/<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>/);
  return !!divNesting;
}

function checkSemanticStructure(code: string): boolean {
  // Check for semantic HTML elements
  const semanticElements = ['<main', '<section', '<nav', '<header', '<footer', '<form', '<article', '<aside'];
  const found = semanticElements.filter((el) => code.toLowerCase().includes(el.toLowerCase()));
  return found.length >= 2;
}

function checkSeparationOfConcerns(code: string, framework: Framework): boolean {
  switch (framework) {
    case 'react': {
      // Check if there's a separation between state logic and rendering
      const hasCustomHooks = code.match(/use[A-Z]\w+/);
      const hasEventHandlers = code.match(/const\s+handle\w+|onClick|onSubmit/);
      return !!(hasCustomHooks || hasEventHandlers);
    }
    case 'vue': {
      const hasComputed = code.includes('computed');
      const hasMethods = code.match(/function\s+\w+|const\s+\w+\s*=/);
      return !!(hasComputed || hasMethods);
    }
    case 'stra': {
      // STRA: dispatchAction for logic, renderer for view
      const hasDispatchAction = code.includes('dispatchAction');
      const hasRenderFunction = code.match(/render|Renderer|function\s+render/);
      return !!(hasDispatchAction && hasRenderFunction);
    }
  }
}

function detectStructuralErrors(code: string): string[] {
  const errors: string[] = [];

  // Unmatched brackets
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (Math.abs(openBraces - closeBraces) > 2) {
    errors.push('unbalanced_braces');
  }

  // Missing closing tags
  const openTags = (code.match(/<(\w+)[\s>]/g) || []).length;
  const closeTags = (code.match(/<\/\w+>/g) || []).length;
  if (openTags - closeTags > 10) {
    errors.push('unclosed_tags');
  }

  // Inline styles with !important (code smell)
  if ((code.match(/!important/g) || []).length > 3) {
    errors.push('important_override');
  }

  // Hardcoded state values (magic strings)
  if ((code.match(/=['"](?:true|false|null|undefined)['"]/g) || []).length > 5) {
    errors.push('hardcoded_state');
  }

  // Component god pattern (single function doing everything)
  const longFunctions = code.match(/function\s+\w+[^}]{2000,}/g);
  if (longFunctions && longFunctions.length > 0) {
    errors.push('god_function');
  }

  return errors;
}
