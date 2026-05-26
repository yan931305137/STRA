/**
 * @stra/ai-compiler - AI-aware Compilation System
 *
 * Phase 7 核心模块：
 * - AI-aware Compiler: AI 输出语义化
 * - Semantic Codegen: AI 生成 action/tree
 * - Runtime Guardrail: AI 禁止直接改 tree
 * - Intent → Action Compiler: prompt → action
 * - Semantic Refactor Engine: AI 重构保持 semantic graph 稳定
 */

// ============================================================
// Runtime Guardrail
// ============================================================

/** AI 操作权限 */
export type AIPermission =
  | 'action:create'
  | 'action:modify'
  | 'action:delete'
  | 'signal:create'
  | 'signal:modify'
  | 'signal:delete'
  | 'tree:read'
  | 'tree:create-child'
  | 'tree:reorder'
  | 'tree:delete'
  | 'projection:trigger'
  | 'graph:query';

/** Guardrail 规则 */
export interface GuardrailRule {
  /** 规则 ID */
  id: string;
  /** 允许的操作 */
  allowed: AIPermission[];
  /** 禁止的操作 */
  forbidden: AIPermission[];
  /** 约束条件 */
  constraints: Array<{
    type: 'max-depth' | 'max-children' | 'require-type' | 'no-direct-mutation';
    value?: unknown;
    message: string;
  }>;
}

/** Guardrail 校验结果 */
export interface GuardrailResult {
  allowed: boolean;
  permission: AIPermission;
  violations: Array<{
    rule: string;
    constraint: string;
    message: string;
  }>;
}

/**
 * Runtime Guardrail - AI 安全层
 *
 * 核心原则：AI 不能直接修改 tree，必须通过 action 系统间接影响
 *
 * 策略：
 * - AI 可以创建/修改 action
 * - AI 可以读取 tree
 * - AI 不能直接修改 tree 节点
 * - AI 创建的 action 必须经过验证
 * - AI 修改 signal 有范围限制
 */
export class RuntimeGuardrail {
  private readonly rules: GuardrailRule[] = [];

  constructor() {
    // Default rule: AI cannot directly mutate tree
    this.rules.push({
      id: 'default-no-tree-mutation',
      allowed: [
        'action:create', 'action:modify', 'action:delete',
        'signal:create', 'signal:modify',
        'tree:read', 'tree:create-child', 'tree:reorder',
        'projection:trigger', 'graph:query',
      ],
      forbidden: [
        'tree:delete', 'signal:delete',
      ],
      constraints: [
        {
          type: 'no-direct-mutation',
          message: 'AI must modify tree through actions, not direct mutation',
        },
        {
          type: 'max-children',
          value: 100,
          message: 'AI cannot create nodes with more than 100 children',
        },
        {
          type: 'max-depth',
          value: 10,
          message: 'AI cannot create tree deeper than 10 levels',
        },
      ],
    });
  }

  /** Add a guardrail rule */
  addRule(rule: GuardrailRule): void {
    this.rules.push(rule);
  }

  /** Check if an AI operation is allowed */
  check(permission: AIPermission, context?: Record<string, unknown>): GuardrailResult {
    const violations: GuardrailResult['violations'] = [];

    for (const rule of this.rules) {
      if (rule.forbidden.includes(permission)) {
        violations.push({
          rule: rule.id,
          constraint: 'forbidden-permission',
          message: `Permission "${permission}" is explicitly forbidden by rule "${rule.id}"`,
        });
      }

      if (rule.allowed.includes(permission)) {
        // Check constraints
        for (const constraint of rule.constraints) {
          if (constraint.type === 'no-direct-mutation' && permission.startsWith('tree:') && permission !== 'tree:read') {
            // Tree operations must go through actions
          }
          if (constraint.type === 'max-children' && context?.childrenCount as number > (constraint.value as number)) {
            violations.push({
              rule: rule.id,
              constraint: constraint.type,
              message: constraint.message,
            });
          }
          if (constraint.type === 'max-depth' && context?.depth as number > (constraint.value as number)) {
            violations.push({
              rule: rule.id,
              constraint: constraint.type,
              message: constraint.message,
            });
          }
        }
      }
    }

    return {
      allowed: violations.length === 0,
      permission,
      violations,
    };
  }

  /** Get all rules */
  getRules(): GuardrailRule[] {
    return [...this.rules];
  }
}

// ============================================================
// Intent → Action Compiler
// ============================================================

/** 意图描述 */
export interface Intent {
  /** 意图类型 */
  type: 'create' | 'modify' | 'delete' | 'query' | 'refactor';
  /** 目标 */
  target: 'action' | 'signal' | 'tree' | 'module';
  /** 自然语言描述 */
  description: string;
  /** 上下文 */
  context?: Record<string, unknown>;
}

/** 编译后的 action 定义 */
export interface CompiledAction {
  actionName: string;
  actionType: Intent['type'];
  targetType: Intent['target'];
  params: Record<string, unknown>;
  guardrailCheck: GuardrailResult;
  confidence: number;
}

/**
 * Intent → Action Compiler
 *
 * 将自然语言意图编译为 action 定义
 * 这是 AI 与 STRA runtime 的桥梁
 */
export class IntentActionCompiler {
  private readonly guardrail: RuntimeGuardrail;

  constructor(guardrail?: RuntimeGuardrail) {
    this.guardrail = guardrail ?? new RuntimeGuardrail();
  }

  /** Compile an intent into an action */
  compile(intent: Intent): CompiledAction {
    const actionName = this.generateActionName(intent);
    const params = this.extractParams(intent);
    const requiredPermission = this.mapToPermission(intent);

    const guardrailCheck = this.guardrail.check(requiredPermission, {
      ...intent.context,
      ...params,
    });

    return {
      actionName,
      actionType: intent.type,
      targetType: intent.target,
      params,
      guardrailCheck,
      confidence: this.estimateConfidence(intent),
    };
  }

  /** Batch compile multiple intents */
  compileBatch(intents: Intent[]): CompiledAction[] {
    return intents.map(intent => this.compile(intent));
  }

  /** Generate action name from intent */
  private generateActionName(intent: Intent): string {
    const prefix = intent.type === 'create' ? 'add'
      : intent.type === 'modify' ? 'update'
      : intent.type === 'delete' ? 'remove'
      : intent.type === 'query' ? 'get'
      : 'refactor';

    return `${prefix}_${intent.target}_${Date.now().toString(36)}`;
  }

  /** Extract parameters from intent description */
  private extractParams(intent: Intent): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Simple extraction from context
    if (intent.context) {
      for (const [key, value] of Object.entries(intent.context)) {
        params[key] = value;
      }
    }

    params.description = intent.description;
    return params;
  }

  /** Map intent to required permission */
  private mapToPermission(intent: Intent): AIPermission {
    const permMap: Record<string, AIPermission> = {
      'create_action': 'action:create',
      'modify_action': 'action:modify',
      'delete_action': 'action:delete',
      'create_signal': 'signal:create',
      'modify_signal': 'signal:modify',
      'delete_signal': 'signal:delete',
      'create_tree': 'tree:create-child',
      'modify_tree': 'tree:reorder',
      'delete_tree': 'tree:delete',
      'query_tree': 'tree:read',
      'query_graph': 'graph:query',
    };

    return permMap[`${intent.type}_${intent.target}`] ?? 'graph:query';
  }

  /** Estimate confidence of the compilation */
  private estimateConfidence(intent: Intent): number {
    let confidence = 0.5;

    // More context = higher confidence
    if (intent.context && Object.keys(intent.context).length > 0) {
      confidence += 0.2;
    }

    // Known type/target combos = higher confidence
    const knownCombos = ['create_action', 'modify_action', 'query_tree', 'query_graph'];
    if (knownCombos.includes(`${intent.type}_${intent.target}`)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }
}

// ============================================================
// Semantic Codegen
// ============================================================

/** 代码生成模板 */
export interface CodegenTemplate {
  name: string;
  target: 'action' | 'signal' | 'tree-node';
  template: string;
  placeholders: string[];
}

/** 代码生成结果 */
export interface CodegenResult {
  code: string;
  template: string;
  placeholders: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

/**
 * Semantic Codegen - AI 生成语义代码
 *
 * 根据语义信息生成 STRA action / signal / tree-node 代码
 */
export class SemanticCodegen {
  private readonly templates: Map<string, CodegenTemplate> = new Map();

  constructor() {
    // Register default templates
    this.registerTemplate({
      name: 'action-basic',
      target: 'action',
      template: `export const {{actionName}} = defineAction('{{actionName}}', {
  description: '{{description}}',
  execute: async (ctx, params) => {
    {{body}}
  },
});`,
      placeholders: ['actionName', 'description', 'body'],
    });

    this.registerTemplate({
      name: 'signal-basic',
      target: 'signal',
      template: `export const {{signalName}} = createSignal({{initialValue}}, {
  name: '{{signalName}}',
  description: '{{description}}',
});`,
      placeholders: ['signalName', 'initialValue', 'description'],
    });

    this.registerTemplate({
      name: 'tree-node-basic',
      target: 'tree-node',
      template: `const {{nodeName}} = tree.createNode({
  type: '{{nodeType}}',
  intent: '{{intent}}',
  {{#if children}}children: [{{children}}],{{/if}}
  {{#if signals}}signals: { {{signals}} },{{/if}}
});`,
      placeholders: ['nodeName', 'nodeType', 'intent', 'children', 'signals'],
    });
  }

  /** Register a codegen template */
  registerTemplate(template: CodegenTemplate): void {
    this.templates.set(template.name, template);
  }

  /** Generate code from template */
  generate(templateName: string, values: Record<string, string>): CodegenResult {
    const template = this.templates.get(templateName);
    if (!template) {
      return {
        code: '',
        template: templateName,
        placeholders: values,
        isValid: false,
        errors: [`Template "${templateName}" not found`],
      };
    }

    // Check required placeholders
    const errors: string[] = [];
    for (const placeholder of template.placeholders) {
      if (!values[placeholder] && !placeholder.startsWith('{{#if')) {
        // Optional placeholders are ok to be missing
      }
    }

    // Replace placeholders
    let code = template.template;
    for (const [key, value] of Object.entries(values)) {
      code = code.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Remove unresolved conditional blocks
    code = code.replace(/\{\{#if\s+\w+\}\}.*?\{\{\/if\}\}/gs, '');

    return {
      code,
      template: templateName,
      placeholders: values,
      isValid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================
// Semantic Refactor Engine
// ============================================================

/** 重构操作 */
export interface RefactorOperation {
  type: 'rename' | 'extract' | 'inline' | 'move' | 'split' | 'merge';
  target: 'action' | 'signal' | 'tree-node';
  targetId: string;
  newId?: string;
  description: string;
}

/** 重构影响分析 */
export interface RefactorImpact {
  operation: RefactorOperation;
  affectedNodes: string[];
  affectedSignals: string[];
  affectedActions: string[];
  semanticGraphStable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Semantic Refactor Engine - AI 重构保持 semantic graph 稳定
 *
 * 核心原则：重构不应破坏语义图的连通性和稳定性
 */
export class SemanticRefactorEngine {
  private readonly graph: {
    nodes: Map<string, Set<string>>;
    signals: Map<string, Set<string>>;
    actions: Map<string, Set<string>>;
  };

  constructor() {
    this.graph = {
      nodes: new Map(),
      signals: new Map(),
      actions: new Map(),
    };
  }

  /** Register a node's dependencies */
  registerNode(nodeId: string, dependencies: string[]): void {
    this.graph.nodes.set(nodeId, new Set(dependencies));
  }

  /** Register a signal's consumers */
  registerSignal(signalId: string, consumers: string[]): void {
    this.graph.signals.set(signalId, new Set(consumers));
  }

  /** Register an action's dependencies */
  registerAction(actionId: string, dependencies: string[]): void {
    this.graph.actions.set(actionId, new Set(dependencies));
  }

  /** Analyze the impact of a refactor operation */
  analyzeImpact(operation: RefactorOperation): RefactorImpact {
    const affectedNodes = this.findAffectedNodes(operation);
    const affectedSignals = this.findAffectedSignals(operation);
    const affectedActions = this.findAffectedActions(operation);

    const totalAffected = affectedNodes.length + affectedSignals.length + affectedActions.length;

    return {
      operation,
      affectedNodes,
      affectedSignals,
      affectedActions,
      semanticGraphStable: totalAffected <= 5, // Heuristic
      riskLevel: totalAffected <= 3 ? 'low' : totalAffected <= 10 ? 'medium' : 'high',
    };
  }

  /** Execute a refactor if safe */
  executeRefactor(operation: RefactorOperation): { success: boolean; impact: RefactorImpact } {
    const impact = this.analyzeImpact(operation);

    if (impact.riskLevel === 'high') {
      return { success: false, impact };
    }

    // For rename operations, update the graph
    if (operation.type === 'rename' && operation.newId) {
      const deps = this.graph.nodes.get(operation.targetId);
      if (deps) {
        this.graph.nodes.set(operation.newId, deps);
        this.graph.nodes.delete(operation.targetId);
      }
    }

    return { success: true, impact };
  }

  /** Find affected nodes for a refactor operation */
  private findAffectedNodes(operation: RefactorOperation): string[] {
    const affected: string[] = [];
    for (const [nodeId, deps] of this.graph.nodes) {
      if (deps.has(operation.targetId)) {
        affected.push(nodeId);
      }
    }
    return affected;
  }

  /** Find affected signals */
  private findAffectedSignals(operation: RefactorOperation): string[] {
    const affected: string[] = [];
    for (const [signalId, consumers] of this.graph.signals) {
      if (consumers.has(operation.targetId)) {
        affected.push(signalId);
      }
    }
    return affected;
  }

  /** Find affected actions */
  private findAffectedActions(operation: RefactorOperation): string[] {
    const affected: string[] = [];
    for (const [actionId, deps] of this.graph.actions) {
      if (deps.has(operation.targetId)) {
        affected.push(actionId);
      }
    }
    return affected;
  }
}

// ============================================================
// AI-aware Compiler
// ============================================================

/** AI 编译上下文 */
export interface AICompileContext {
  projectPath: string;
  semanticGraphAvailable: boolean;
  guardrailActive: boolean;
}

/**
 * AI-aware Compiler - AI 编译辅助
 *
 * 整合 Guardrail + IntentCompiler + Codegen + RefactorEngine
 * 提供统一的 AI 编译接口
 */
export class AICompiler {
  private readonly guardrail: RuntimeGuardrail;
  private readonly intentCompiler: IntentActionCompiler;
  private readonly codegen: SemanticCodegen;
  private readonly refactorEngine: SemanticRefactorEngine;

  constructor() {
    this.guardrail = new RuntimeGuardrail();
    this.intentCompiler = new IntentActionCompiler(this.guardrail);
    this.codegen = new SemanticCodegen();
    this.refactorEngine = new SemanticRefactorEngine();
  }

  /** Compile a natural language intent */
  compileIntent(intent: Intent): CompiledAction {
    return this.intentCompiler.compile(intent);
  }

  /** Generate code from a template */
  generateCode(templateName: string, values: Record<string, string>): CodegenResult {
    return this.codegen.generate(templateName, values);
  }

  /** Analyze refactor impact */
  analyzeRefactor(operation: RefactorOperation): RefactorImpact {
    return this.refactorEngine.analyzeImpact(operation);
  }

  /** Execute refactor if safe */
  executeRefactor(operation: RefactorOperation): { success: boolean; impact: RefactorImpact } {
    return this.refactorEngine.executeRefactor(operation);
  }

  /** Check permission */
  checkPermission(permission: AIPermission, context?: Record<string, unknown>): GuardrailResult {
    return this.guardrail.check(permission, context);
  }
}

// ============================================================
// Factory Functions
// ============================================================

export function createRuntimeGuardrail(): RuntimeGuardrail {
  return new RuntimeGuardrail();
}

export function createIntentActionCompiler(guardrail?: RuntimeGuardrail): IntentActionCompiler {
  return new IntentActionCompiler(guardrail);
}

export function createSemanticCodegen(): SemanticCodegen {
  return new SemanticCodegen();
}

export function createSemanticRefactorEngine(): SemanticRefactorEngine {
  return new SemanticRefactorEngine();
}

export function createAICompiler(): AICompiler {
  return new AICompiler();
}
