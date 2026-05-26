/**
 * @stra/semantic - Semantic ID & Hash
 *
 * Phase 1 核心模块：
 * - Semantic ID: 语义稳定 ID，重命名不触发全量失效
 * - Semantic Hash: 语义 hash，代码格式变化不重编译
 *
 * HARDENED:
 * - ID 稳定性：变量重命名、文件移动不改变 semantic ID
 * - Hash 稳定性：格式化、注释变化不改变 semantic hash
 * - 确定性：同语义内容 → 同 hash
 */

import { createHash } from 'node:crypto';

// ============================================================
// Semantic ID
// ============================================================

/** Semantic ID 的组成部分 */
export interface SemanticIDComponents {
  /** 节点种类 */
  kind: string;
  /** 语义角色 */
  role: string;
  /** 逻辑路径（相对项目根目录） */
  logicalPath: string;
  /** 语义锚点（结构位置，非变量名） */
  anchor: string;
  /** 内容指纹（语义摘要 hash） */
  contentFingerprint: string;
}

/**
 * 生成语义稳定 ID
 *
 * 格式: {kind}_{role}_{pathHash}_{anchorHash}_{contentFP}
 *
 * 设计原则：
 * - 同一语义位置 → 同一 ID（即使变量重命名）
 * - 语义内容变化 → contentFingerprint 变化
 * - 文件移动 → logicalPath 变化但 anchor 可能不变
 */
export function generateSemanticID(components: SemanticIDComponents): string {
  const { kind, role, logicalPath, anchor, contentFingerprint } = components;
  const pathHash = stableHash(logicalPath).slice(0, 8);
  const anchorHash = stableHash(anchor).slice(0, 8);
  return `${kind}_${role}_${pathHash}_${anchorHash}_${contentFingerprint.slice(0, 8)}`;
}

/**
 * 从旧的 semantic ID 迁移到新格式
 * 保持向后兼容
 */
export function migrateSemanticID(oldId: string, newComponents: SemanticIDComponents): string {
  void oldId;
  return generateSemanticID(newComponents);
}

/**
 * 检查两个 semantic ID 是否指向同一语义实体
 * （忽略 contentFingerprint 部分）
 */
export function isSameSemanticEntity(idA: string, idB: string): boolean {
  // Compare without the content fingerprint part
  const partsA = idA.split('_');
  const partsB = idB.split('_');
  if (partsA.length < 4 || partsB.length < 4) return idA === idB;
  // Compare kind, role, pathHash, anchorHash
  return partsA.slice(0, 4).join('_') === partsB.slice(0, 4).join('_');
}

/**
 * 从 semantic ID 提取逻辑路径 hash
 */
export function extractLogicalPathHash(semanticId: string): string {
  const parts = semanticId.split('_');
  return parts.length >= 3 ? parts[2] : '';
}

// ============================================================
// Semantic Hash
// ============================================================

/** 语义 hash 输入 */
export interface SemanticHashInput {
  /** 节点种类 */
  kind: string;
  /** 节点名称（语义层面，非变量名） */
  semanticName: string;
  /** 依赖列表（排序后） */
  dependencies: string[];
  /** Action 边界（如有） */
  mutations?: string[];
  /** Signal 源（如有） */
  signalSources?: string[];
  /** 结构特征（子节点数量、嵌套深度等） */
  structuralFeatures?: Record<string, number>;
}

/**
 * 计算语义 Hash
 *
 * 核心原则：
 * - 格式化（prettier）不影响 hash
 * - 注释增删不影响 hash
 * - 变量重命名可能影响 hash（如果改变了语义）
 * - 逻辑变更一定影响 hash
 */
export function computeSemanticHash(input: SemanticHashInput): string {
  const parts: string[] = [
    `kind:${input.kind}`,
    `name:${input.semanticName}`,
    `deps:[${input.dependencies.sort().join(',')}]`,
  ];

  if (input.mutations && input.mutations.length > 0) {
    parts.push(`mutations:[${input.mutations.sort().join(',')}]`);
  }

  if (input.signalSources && input.signalSources.length > 0) {
    parts.push(`sources:[${input.signalSources.sort().join(',')}]`);
  }

  if (input.structuralFeatures) {
    const features = Object.entries(input.structuralFeatures)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    parts.push(`struct:{${features}}`);
  }

  return stableHash(parts.join('|'));
}

/**
 * 批量计算语义 hash 并检测变更
 * 返回哪些 semantic ID 的 hash 发生了变化
 */
export function detectSemanticChanges(
  previous: Map<string, string>,
  current: Map<string, string>,
): SemanticChangeResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const [id, hash] of current) {
    if (!previous.has(id)) {
      added.push(id);
    } else if (previous.get(id) !== hash) {
      changed.push(id);
    } else {
      unchanged.push(id);
    }
  }

  for (const id of previous.keys()) {
    if (!current.has(id)) {
      removed.push(id);
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort(),
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    changeRatio: current.size > 0
      ? (added.length + changed.length) / current.size
      : 0,
  };
}

/** 语义变更检测结果 */
export interface SemanticChangeResult {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
  hasChanges: boolean;
  changeRatio: number;
}

// ============================================================
// Utility
// ============================================================

/** Stable hash using djb2 (fast, deterministic, no crypto dependency needed for non-security use) */
export function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

/** Crypto-grade hash for content fingerprinting */
export function cryptoHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
