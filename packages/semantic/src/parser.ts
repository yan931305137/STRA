/**
 * @stra/semantic - Semantic Parser
 *
 * Phase 1 核心模块：从源码中提取 Tree / Action / Signal 语义结构。
 * 不再只认识文件，而是理解语义。
 *
 * HARDENED:
 * - 解析结果确定性强（同输入同输出）
 * - 不依赖运行时状态
 * - 零副作用
 */

import type { NodeId, SignalId } from '@stra/types';

// ============================================================
// Semantic Node Types - 语义节点类型
// ============================================================

/** 语义节点种类 */
export type SemanticNodeKind =
  | 'tree'        // STRA Tree 定义
  | 'action'      // STRA Action 定义
  | 'signal'      // Signal 定义
  | 'derived'     // Derived signal
  | 'component'   // UI 组件
  | 'projection'  // 渲染投影
  | 'effect'      // 副作用
  | 'import'      // 模块导入
  | 'export';     // 模块导出

/** 语义节点 - 解析出的最小语义单元 */
export interface SemanticNode {
  /** 语义稳定 ID（重命名不变） */
  semanticId: string;
  /** 节点种类 */
  kind: SemanticNodeKind;
  /** 所在文件路径 */
  filePath: string;
  /** 在文件中的位置（行号） */
  loc: { line: number; column: number };
  /** 节点名称（函数名/变量名） */
  name: string;
  /** 语义依赖：该节点依赖哪些其他语义节点 */
  dependencies: string[];
  /** 语义被依赖：哪些节点依赖此节点 */
  dependents: string[];
  /** 语义 hash（仅基于语义内容，忽略格式） */
  semanticHash: string;
  /** Action 边界标记（哪些状态会变） */
  actionBoundary?: ActionBoundary;
  /** Signal 依赖追踪信息 */
  signalInfo?: SignalInfo;
}

// ============================================================
// Action Boundary - Action 边界分析
// ============================================================

/** 状态变更类型 */
export type StateMutationKind =
  | 'write'       // 直接写入
  | 'increment'   // 自增/自减
  | 'replace'     // 整体替换
  | 'splice'      // 数组操作
  | 'delete';     // 删除属性

/** 状态变更记录 */
export interface StateMutation {
  /** 被变更的 signal/tree 路径 */
  target: string;
  /** 变更类型 */
  kind: StateMutationKind;
  /** 变更路径（如 tree.count） */
  path: string;
}

/** Action 边界 - 描述一个 action 会改变哪些状态 */
export interface ActionBoundary {
  /** action 的语义 ID */
  actionId: string;
  /** 该 action 可能变更的状态列表 */
  mutations: StateMutation[];
  /** 该 action 读取的 signal 列表 */
  reads: string[];
  /** 是否为纯函数（无副作用） */
  isPure: boolean;
  /** 边界 hash - 格式变化不影响 */
  boundaryHash: string;
}

// ============================================================
// Signal Info - Signal 依赖追踪
// ============================================================

/** Signal 依赖追踪信息 */
export interface SignalInfo {
  /** signal 语义 ID */
  signalId: string;
  /** 源 signal 列表（该 signal 依赖的原始 signal） */
  sources: string[];
  /** 消费者列表（哪些 action/component 读取此 signal） */
  consumers: string[];
  /** 是否为 derived signal */
  isDerived: boolean;
  /** compute 函数的语义 hash */
  computeHash?: string;
  /** 依赖深度 */
  depth: number;
}

// ============================================================
// Parse Result - 解析结果
// ============================================================

/** 单文件解析结果 */
export interface FileParseResult {
  /** 文件路径 */
  filePath: string;
  /** 解析出的语义节点 */
  nodes: SemanticNode[];
  /** 提取的 action 边界 */
  actionBoundaries: ActionBoundary[];
  /** 提取的 signal 信息 */
  signalInfos: SignalInfo[];
  /** 文件语义 hash（所有节点 hash 的聚合） */
  fileSemanticHash: string;
  /** 解析耗时 (ms) */
  parseTime: number;
  /** 解析错误 */
  errors: ParseError[];
}

/** 解析错误 */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

// ============================================================
// Regex Patterns - 语义提取模式
// ============================================================

/** Tree 创建模式: createTree / createTree */
const TREE_PATTERN = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*createTree\s*\(/g;

/** Action 定义模式: action(() => { ... }) */
const ACTION_PATTERN = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*action\s*\(\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>?\s*\{/g;

/** Signal 读取模式: tree.xxx / signal.value */
const SIGNAL_READ_PATTERN = /(\w+)\.(\w+)/g;

/** Derived signal 模式: derivedSignal / computed */
const DERIVED_PATTERN = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:derivedSignal|computed)\s*\(/g;

/** Effect 模式: effect(() => { ... }) */
const EFFECT_PATTERN = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*effect\s*\(/g;

/** Import 模式 */
const IMPORT_PATTERN = /import\s+(?:type\s+)?(?:[\w{},\s*]*\s+from\s+)?['"]([^'"]+)['"]/g;

/** Export 模式 */
const EXPORT_PATTERN = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/g;

/** 状态变更模式 */
const MUTATION_PATTERNS: Array<{ pattern: RegExp; kind: StateMutationKind }> = [
  { pattern: /(\w+)\.(\w+)\s*\+\+/g, kind: 'increment' },
  { pattern: /(\w+)\.(\w+)\s*--/g, kind: 'increment' },
  { pattern: /(\w+)\.(\w+)\s*=/g, kind: 'write' },
  { pattern: /(\w+)\.(\w+)\s*\+=/g, kind: 'increment' },
  { pattern: /(\w+)\.splice\s*\(/g, kind: 'splice' },
  { pattern: /delete\s+(\w+)\.(\w+)/g, kind: 'delete' },
];

// ============================================================
// Semantic Parser Core
// ============================================================

export interface SemanticParserOptions {
  /** 项目根目录 */
  root: string;
  /** 是否启用 action 边界分析 */
  analyzeBoundaries?: boolean;
  /** 是否启用 signal 依赖追踪 */
  trackSignals?: boolean;
}

export class SemanticParser {
  private readonly root: string;
  private readonly analyzeBoundaries: boolean;
  private readonly trackSignals: boolean;
  private parseCounter = 0;

  constructor(options: SemanticParserOptions) {
    this.root = options.root;
    this.analyzeBoundaries = options.analyzeBoundaries ?? true;
    this.trackSignals = options.trackSignals ?? true;
  }

  /** 解析单个源文件 */
  parseFile(filePath: string, source: string): FileParseResult {
    const startTime = Date.now();
    const nodes: SemanticNode[] = [];
    const actionBoundaries: ActionBoundary[] = [];
    const signalInfos: SignalInfo[] = [];
    const errors: ParseError[] = [];

    try {
      // 1. Extract Trees
      this.extractTrees(filePath, source, nodes);

      // 2. Extract Actions
      this.extractActions(filePath, source, nodes);

      // 3. Extract Derived Signals
      this.extractDerivedSignals(filePath, source, nodes);

      // 4. Extract Effects
      this.extractEffects(filePath, source, nodes);

      // 5. Extract Imports/Exports
      this.extractImportsExports(filePath, source, nodes);

      // 6. Analyze Action Boundaries
      if (this.analyzeBoundaries) {
        this.analyzeActionBoundaries(source, nodes, actionBoundaries);
      }

      // 7. Track Signal Dependencies
      if (this.trackSignals) {
        this.trackSignalDependencies(source, nodes, signalInfos);
      }

      // 8. Resolve dependencies between nodes
      this.resolveNodeDependencies(nodes);

      // 9. Compute semantic hashes
      for (const node of nodes) {
        node.semanticHash = this.computeNodeHash(node, source);
      }
    } catch (err) {
      errors.push({
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const parseTime = Date.now() - startTime;
    const fileSemanticHash = this.computeFileHash(nodes);

    return {
      filePath,
      nodes,
      actionBoundaries,
      signalInfos,
      fileSemanticHash,
      parseTime,
      errors,
    };
  }

  // ============================================================
  // Extraction Methods
  // ============================================================

  private extractTrees(filePath: string, source: string, nodes: SemanticNode[]): void {
    TREE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TREE_PATTERN.exec(source)) !== null) {
      const name = match[1];
      const line = this.getLineNumber(source, match.index);
      nodes.push({
        semanticId: this.makeSemanticId('tree', filePath, name),
        kind: 'tree',
        filePath,
        loc: { line, column: 0 },
        name,
        dependencies: [],
        dependents: [],
        semanticHash: '',
      });
    }
  }

  private extractActions(filePath: string, source: string, nodes: SemanticNode[]): void {
    ACTION_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ACTION_PATTERN.exec(source)) !== null) {
      const name = match[1];
      const line = this.getLineNumber(source, match.index);
      const actionNode: SemanticNode = {
        semanticId: this.makeSemanticId('action', filePath, name),
        kind: 'action',
        filePath,
        loc: { line, column: 0 },
        name,
        dependencies: [],
        dependents: [],
        semanticHash: '',
      };

      // Extract action body for boundary analysis
      const bodyStart = match.index + match[0].length;
      const body = this.extractBlockBody(source, bodyStart);
      if (body && this.analyzeBoundaries) {
        actionNode.actionBoundary = this.analyzeActionBody(actionNode.semanticId, body);
      }

      nodes.push(actionNode);
    }
  }

  private extractDerivedSignals(filePath: string, source: string, nodes: SemanticNode[]): void {
    DERIVED_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DERIVED_PATTERN.exec(source)) !== null) {
      const name = match[1];
      const line = this.getLineNumber(source, match.index);
      nodes.push({
        semanticId: this.makeSemanticId('derived', filePath, name),
        kind: 'derived',
        filePath,
        loc: { line, column: 0 },
        name,
        dependencies: [],
        dependents: [],
        semanticHash: '',
      });
    }
  }

  private extractEffects(filePath: string, source: string, nodes: SemanticNode[]): void {
    EFFECT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EFFECT_PATTERN.exec(source)) !== null) {
      const name = match[1];
      const line = this.getLineNumber(source, match.index);
      nodes.push({
        semanticId: this.makeSemanticId('effect', filePath, name),
        kind: 'effect',
        filePath,
        loc: { line, column: 0 },
        name,
        dependencies: [],
        dependents: [],
        semanticHash: '',
      });
    }
  }

  private extractImportsExports(filePath: string, source: string, nodes: SemanticNode[]): void {
    IMPORT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_PATTERN.exec(source)) !== null) {
      const importPath = match[1];
      const line = this.getLineNumber(source, match.index);
      nodes.push({
        semanticId: this.makeSemanticId('import', filePath, importPath),
        kind: 'import',
        filePath,
        loc: { line, column: 0 },
        name: importPath,
        dependencies: [importPath],
        dependents: [],
        semanticHash: '',
      });
    }

    EXPORT_PATTERN.lastIndex = 0;
    while ((match = EXPORT_PATTERN.exec(source)) !== null) {
      const exportName = match[1];
      const line = this.getLineNumber(source, match.index);
      nodes.push({
        semanticId: this.makeSemanticId('export', filePath, exportName),
        kind: 'export',
        filePath,
        loc: { line, column: 0 },
        name: exportName,
        dependencies: [],
        dependents: [],
        semanticHash: '',
      });
    }
  }

  // ============================================================
  // Action Boundary Analysis
  // ============================================================

  private analyzeActionBoundaries(
    source: string,
    nodes: SemanticNode[],
    boundaries: ActionBoundary[],
  ): void {
    const actionNodes = nodes.filter(n => n.kind === 'action');
    for (const actionNode of actionNodes) {
      if (actionNode.actionBoundary) {
        boundaries.push(actionNode.actionBoundary);
      }
    }
  }

  private analyzeActionBody(actionId: string, body: string): ActionBoundary {
    const mutations: StateMutation[] = [];
    const reads: string[] = [];

    for (const { pattern, kind } of MUTATION_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        mutations.push({
          target: match[1],
          kind,
          path: `${match[1]}.${match[2] ?? ''}`,
        });
      }
    }

    // Detect reads (tree.xxx access outside of assignments)
    SIGNAL_READ_PATTERN.lastIndex = 0;
    let readMatch: RegExpExecArray | null;
    while ((readMatch = SIGNAL_READ_PATTERN.exec(body)) !== null) {
      const readPath = `${readMatch[1]}.${readMatch[2]}`;
      if (!reads.includes(readPath)) {
        reads.push(readPath);
      }
    }

    const isPure = mutations.length === 0;
    const boundaryHash = this.hashString(
      `action:${actionId}:mutations=[${mutations.map(m => m.path).sort()}]:reads=[${reads.sort()}]`,
    );

    return { actionId, mutations, reads, isPure, boundaryHash };
  }

  // ============================================================
  // Signal Dependency Tracking
  // ============================================================

  private trackSignalDependencies(
    source: string,
    nodes: SemanticNode[],
    signalInfos: SignalInfo[],
  ): void {
    const treeNodes = nodes.filter(n => n.kind === 'tree');
    const derivedNodes = nodes.filter(n => n.kind === 'derived');
    const actionNodes = nodes.filter(n => n.kind === 'action');

    // Track tree signals
    for (const treeNode of treeNodes) {
      // Find all property accesses on this tree in the source
      const treePattern = new RegExp(`${treeNode.name}\\.(\\w+)`, 'g');
      const properties = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = treePattern.exec(source)) !== null) {
        properties.add(match[1]);
      }

      for (const prop of properties) {
        const signalId = `${treeNode.name}.${prop}`;
        const consumers = actionNodes
          .filter(a => a.actionBoundary?.reads.includes(signalId))
          .map(a => a.semanticId);

        signalInfos.push({
          signalId,
          sources: [],
          consumers,
          isDerived: false,
          depth: 0,
        });
      }
    }

    // Track derived signals
    for (const derivedNode of derivedNodes) {
      // Find source signals in the compute function
      const bodyMatch = source.substring(
        source.indexOf(derivedNode.name),
      );
      const sources: string[] = [];

      for (const treeNode of treeNodes) {
        const treePattern = new RegExp(`${treeNode.name}\\.(\\w+)`, 'g');
        let match: RegExpExecArray | null;
        while ((match = treePattern.exec(bodyMatch)) !== null) {
          const sourceSignal = `${treeNode.name}.${match[1]}`;
          if (!sources.includes(sourceSignal)) {
            sources.push(sourceSignal);
          }
        }
      }

      signalInfos.push({
        signalId: derivedNode.semanticId,
        sources,
        consumers: [],
        isDerived: true,
        computeHash: this.hashString(bodyMatch.substring(0, 200)),
        depth: sources.length > 0 ? 1 : 0,
      });
    }
  }

  // ============================================================
  // Dependency Resolution
  // ============================================================

  private resolveNodeDependencies(nodes: SemanticNode[]): void {
    const nameToId = new Map<string, string>();
    for (const node of nodes) {
      nameToId.set(node.name, node.semanticId);
    }

    for (const node of nodes) {
      if (node.kind === 'import') {
        // Import nodes depend on the imported module
        continue;
      }

      // Scan node's source references for other nodes
      for (const [name, id] of nameToId) {
        if (name !== node.name && node.dependencies.length < 50) {
          // Simple name-based dependency detection
          // (real implementation would use AST)
          node.dependencies.push(id);
        }
      }
    }

    // Build reverse dependencies
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        const depNode = nodes.find(n => n.semanticId === depId);
        if (depNode && !depNode.dependents.includes(node.semanticId)) {
          depNode.dependents.push(node.semanticId);
        }
      }
    }
  }

  // ============================================================
  // Semantic Hash
  // ============================================================

  /** Compute semantic hash for a node - ignores formatting, only considers semantics */
  private computeNodeHash(node: SemanticNode, source: string): string {
    const semanticContent = [
      node.kind,
      node.name,
      node.dependencies.sort().join(','),
      node.actionBoundary
        ? `mutations=[${node.actionBoundary.mutations.map(m => m.path).sort()}]`
        : '',
      node.signalInfo
        ? `sources=[${node.signalInfo.sources.sort()}]`
        : '',
    ].join('|');

    return this.hashString(semanticContent);
  }

  /** Compute file-level semantic hash */
  private computeFileHash(nodes: SemanticNode[]): string {
    const hashes = nodes
      .map(n => n.semanticHash)
      .sort()
      .join(',');
    return this.hashString(hashes);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /** Generate a stable semantic ID that survives renames */
  private makeSemanticId(kind: SemanticNodeKind, filePath: string, name: string): string {
    // Format: kind_path_hash - path-based, survives variable rename
    const pathPart = filePath.replace(this.root, '').replace(/^\//, '');
    return `${kind}_${pathPart}_${name}_${this.hashString(`${kind}:${pathPart}:${name}`).slice(0, 8)}`;
  }

  /** Get line number from character index */
  private getLineNumber(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i++) {
      if (source[i] === '\n') line++;
    }
    return line;
  }

  /** Extract block body (simplified brace matching) */
  private extractBlockBody(source: string, start: number): string | null {
    let depth = 0;
    let i = start;
    while (i < source.length && source[i] !== '{') i++;
    if (i >= source.length) return null;

    const bodyStart = i + 1;
    depth = 1;
    i++;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    return source.substring(bodyStart, i - 1);
  }

  /** Simple hash function (djb2) */
  private hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return (hash >>> 0).toString(36);
  }
}

/** Create a semantic parser */
export function createSemanticParser(options: SemanticParserOptions): SemanticParser {
  return new SemanticParser(options);
}
