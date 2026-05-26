/**
 * STRA Semantic Diff Engine - 语义级别的变更对比
 * 
 * 核心价值：AI 能理解"业务层面发生了什么变化"
 * 不是 DOM diff，而是语义 diff：新增了什么业务概念，移除了什么流程
 * 
 * AI rewrite 的基础：diff 语义而非 DOM
 */

import {
  NodeId,
  NodeType,
  SemanticRole,
  SemanticIntent,
  SemanticSchema,
  SemanticExportNode,
  SemanticTreeExport,
  SemanticDiff,
  SemanticRelation,
  RelationType,
} from '@stra/types';
import { RuntimeController } from '@stra/core';
import { TreeWalker } from '@stra/core';

let diffCounter = 0;

/** 扁平化导出树为 ID → Node 映射 */
function flattenExportNodes(root: SemanticExportNode): Map<string, SemanticExportNode & { path: string; parentId: string | null }> {
  const map = new Map<string, SemanticExportNode & { path: string; parentId: string | null }>();
  
  function walk(node: SemanticExportNode, path: string, parentId: string | null) {
    const currentPath = path ? `${path}/${node.type}` : node.type;
    map.set(node.id, { ...node, path: currentPath, parentId });
    for (const child of node.children) {
      walk(child, currentPath, node.id);
    }
  }
  
  walk(root, '', null);
  return map;
}

/** 构建节点路径描述 */
function buildPathDescription(path: string): string {
  return path || 'root';
}

/** 判断变更的语义影响级别 */
function classifyChange(field: string, oldValue: unknown, newValue: unknown): SemanticDiff['changed'][number]['changes'][number]['semanticImpact'] {
  // 结构性变更
  if (field === 'role' || field === 'intent') return 'behavioral';
  if (field === 'type') return 'structural';
  // 数据变更
  if (field.startsWith('signals.') || field.startsWith('schema.')) return 'value';
  // 样式变更
  if (field.startsWith('styles.')) return 'cosmetic';
  // 默认
  return 'value';
}

/** 生成变更描述 */
function describeChange(
  type: NodeType,
  role: SemanticRole,
  intent: SemanticIntent,
  field: string,
  oldValue: unknown,
  newValue: unknown,
): string {
  const fieldDesc = field === 'role' ? 'role' : field === 'intent' ? 'intent' : field;
  return `"${type}" (${role}/${intent}): ${fieldDesc} changed from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}`;
}

export class SemanticDiffEngine {
  /**
   * 比较两个语义树导出的差异
   * 
   * 核心原则：
   * - 比较 STABLE ID，不比较 DOM 位置
   * - 变更描述使用业务语义，不用技术术语
   * - 语义影响分级：structural / value / behavioral / cosmetic
   */
  diff(
    baseline: SemanticTreeExport,
    compare: SemanticTreeExport,
  ): SemanticDiff {
    const baselineRelations = baseline.stats.relationCount;
    diffCounter++;

    const added: SemanticDiff['added'] = [];
    const removed: SemanticDiff['removed'] = [];
    const changed: SemanticDiff['changed'] = [];

    // 扁平化两棵树
    const baselineNodes = baseline.root ? flattenExportNodes(baseline.root) : new Map();
    const compareNodes = compare.root ? flattenExportNodes(compare.root) : new Map();

    // 找新增节点
    for (const [id, node] of compareNodes) {
      if (!baselineNodes.has(id)) {
        added.push({
          nodeId: id,
          type: node.type,
          role: node.role,
          intent: node.intent,
          path: buildPathDescription(node.path),
          description: `New ${node.role} node "${node.type}" with intent "${node.intent}" was added at ${node.path}`,
        });
      }
    }

    // 找移除节点
    for (const [id, node] of baselineNodes) {
      if (!compareNodes.has(id)) {
        removed.push({
          nodeId: id,
          type: node.type,
          role: node.role,
          intent: node.intent,
          path: buildPathDescription(node.path),
          description: `${node.role} node "${node.type}" with intent "${node.intent}" was removed from ${node.path}`,
        });
      }
    }

    // 找变更节点
    for (const [id, baselineNode] of baselineNodes) {
      const compareNode = compareNodes.get(id);
      if (!compareNode) continue;

      const changes: SemanticDiff['changed'][number]['changes'] = [];

      // 比较 role
      if (baselineNode.role !== compareNode.role) {
        const field = 'role';
        changes.push({
          field,
          oldValue: baselineNode.role,
          newValue: compareNode.role,
          semanticImpact: classifyChange(field, baselineNode.role, compareNode.role),
          description: describeChange(compareNode.type, baselineNode.role, baselineNode.intent, field, baselineNode.role, compareNode.role),
        });
      }

      // 比较 intent
      if (baselineNode.intent !== compareNode.intent) {
        const field = 'intent';
        changes.push({
          field,
          oldValue: baselineNode.intent,
          newValue: compareNode.intent,
          semanticImpact: classifyChange(field, baselineNode.intent, compareNode.intent),
          description: describeChange(compareNode.type, compareNode.role, baselineNode.intent, field, baselineNode.intent, compareNode.intent),
        });
      }

      // 比较 schema
      this.diffSchema(baselineNode.schema, compareNode.schema, changes, compareNode.type, compareNode.role, compareNode.intent);

      // 比较 signals
      this.diffSignals(baselineNode.signals, compareNode.signals, changes, compareNode.type, compareNode.role, compareNode.intent);

      if (changes.length > 0) {
        const changeDescs = changes.map(c => c.description).join('; ');
        changed.push({
          nodeId: id,
          type: compareNode.type,
          changes,
          description: changeDescs,
        });
      }
    }

    // 生成摘要
    const summary = this.generateSummary(added, removed, changed);

    return {
      id: `diff_${diffCounter}`,
      baselineSnapshotId: `export_${Date.now()}_baseline`,
      summary,
      added,
      removed,
      changed,
      relationsAdded: [], // TODO: 需要在 export 中包含 relations
      relationsRemoved: [],
    };
  }

  /** 与当前运行时比较 */
  diffWithRuntime(
    controller: RuntimeController,
    baseline: SemanticTreeExport,
  ): SemanticDiff {
    const current = controller.exportSemanticTree();
    return this.diff(baseline, current);
  }

  /** 比较 schema 差异 */
  private diffSchema(
    baseline: Readonly<SemanticSchema>,
    compare: Readonly<SemanticSchema>,
    changes: SemanticDiff['changed'][number]['changes'],
    type: NodeType,
    role: SemanticRole,
    intent: SemanticIntent,
  ): void {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(compare)]);
    for (const key of allKeys) {
      const oldVal = baseline[key];
      const newVal = compare[key];
      if (oldVal === newVal) continue;
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

      const field = `schema.${key}`;
      changes.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        semanticImpact: classifyChange(field, oldVal, newVal),
        description: describeChange(type, role, intent, field, oldVal, newVal),
      });
    }
  }

  /** 比较 signals 差异 */
  private diffSignals(
    baseline: Readonly<Record<string, unknown>>,
    compare: Readonly<Record<string, unknown>>,
    changes: SemanticDiff['changed'][number]['changes'],
    type: NodeType,
    role: SemanticRole,
    intent: SemanticIntent,
  ): void {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(compare)]);
    for (const key of allKeys) {
      const oldVal = baseline[key];
      const newVal = compare[key];
      if (oldVal === newVal) continue;
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

      const field = `signals.${key}`;
      changes.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        semanticImpact: classifyChange(field, oldVal, newVal),
        description: describeChange(type, role, intent, field, oldVal, newVal),
      });
    }
  }

  /** 生成 AI 可读的变更摘要 */
  private generateSummary(
    added: SemanticDiff['added'],
    removed: SemanticDiff['removed'],
    changed: SemanticDiff['changed'],
  ): string {
    const parts: string[] = [];

    if (added.length > 0) {
      const addDescs = added.map(a => `"${a.type}" (${a.role})`);
      parts.push(`Added ${added.length} semantic node(s): ${addDescs.join(', ')}`);
    }

    if (removed.length > 0) {
      const removeDescs = removed.map(r => `"${r.type}" (${r.role})`);
      parts.push(`Removed ${removed.length} semantic node(s): ${removeDescs.join(', ')}`);
    }

    if (changed.length > 0) {
      const behaviorChanges = changed.filter(c => c.changes.some(ch => ch.semanticImpact === 'behavioral'));
      const valueChanges = changed.filter(c => c.changes.some(ch => ch.semanticImpact === 'value'));
      const structuralChanges = changed.filter(c => c.changes.some(ch => ch.semanticImpact === 'structural'));

      if (structuralChanges.length > 0) {
        parts.push(`${structuralChanges.length} structural change(s) (type changes)`);
      }
      if (behaviorChanges.length > 0) {
        parts.push(`${behaviorChanges.length} behavioral change(s) (role/intent changes)`);
      }
      if (valueChanges.length > 0) {
        parts.push(`${valueChanges.length} value change(s) (data/signal changes)`);
      }
    }

    if (parts.length === 0) {
      return 'No semantic changes detected.';
    }

    return parts.join('. ') + '.';
  }
}

/** 工厂函数 */
export function createSemanticDiffEngine(): SemanticDiffEngine {
  return new SemanticDiffEngine();
}
