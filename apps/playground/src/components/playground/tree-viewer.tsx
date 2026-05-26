'use client';

import React, { useState } from 'react';
import type { SemanticExportNode } from '@stra/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

// ============================================================
// Color Maps - following DESIGN.md palette
// ============================================================

const PHASE_COLORS: Record<string, string> = {
  created: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  attached: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  suspended: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  detached: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const ROLE_COLORS: Record<string, string> = {
  page: 'text-indigo-400',
  header: 'text-blue-400',
  footer: 'text-blue-400',
  nav: 'text-cyan-400',
  navigation: 'text-cyan-400',
  main: 'text-indigo-400',
  section: 'text-violet-400',
  list: 'text-teal-400',
  item: 'text-emerald-400',
  button: 'text-amber-400',
  field: 'text-pink-400',
  text: 'text-slate-400',
  image: 'text-rose-400',
  link: 'text-sky-400',
  form: 'text-pink-400',
  sidebar: 'text-indigo-400',
  container: 'text-gray-400',
};

const INTENT_COLORS: Record<string, string> = {
  display: 'text-slate-400',
  input: 'text-pink-400',
  action: 'text-amber-400',
  navigation: 'text-cyan-400',
  layout: 'text-blue-400',
  feedback: 'text-green-400',
  decoration: 'text-slate-500',
  data: 'text-teal-400',
  payment: 'text-red-400',
  validation: 'text-yellow-400',
  workflow: 'text-violet-400',
  custom: 'text-gray-400',
};

// ============================================================
// Tree Viewer Component
// ============================================================

interface TreeViewerProps {
  root: SemanticExportNode | null;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

function TreeNodeRow({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: SemanticExportNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const isSelected = selectedId === node.id;
  const isSuspended = node.phase === 'suspended';
  const phaseColor = PHASE_COLORS[node.phase] || 'bg-gray-500/15 text-gray-400';
  const roleColor = ROLE_COLORS[node.role] || 'text-gray-400';
  const intentColor = INTENT_COLORS[node.intent] || 'text-gray-400';
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors text-sm group
          ${isSelected
            ? 'bg-indigo-500/15 text-foreground border-l-2 border-indigo-400'
            : 'hover:bg-muted/40 border-l-2 border-transparent'
          }
          ${isSuspended ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/Collapse */}
        <button
          className="w-3 h-3 shrink-0 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {hasChildren ? (
            <span className={`text-[9px] transition-transform ${expanded ? '' : '-rotate-90'}`}>
              ▼
            </span>
          ) : (
            <span className="text-[6px]">●</span>
          )}
        </button>

        {/* Type name */}
        <span className="font-mono font-medium text-foreground truncate text-xs">
          {node.type}
        </span>

        {/* Role badge */}
        <span className={`text-[9px] ${roleColor}`}>
          {node.role}
        </span>

        {/* Intent */}
        <span className={`text-[9px] ${intentColor}`}>
          {node.intent}
        </span>

        {/* Phase (if not active) */}
        {node.phase !== 'active' && (
          <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${phaseColor}`}>
            {node.phase}
          </Badge>
        )}

        {/* Dirty indicator */}
        {Object.keys(node.signals).length > 0 && (
          <span className="text-[7px] text-emerald-500/70 ml-0.5" title="Has signals">
            ⚡{Object.keys(node.signals).length}
          </span>
        )}

        {/* Node ID (truncated) */}
        <span className="text-[8px] text-muted-foreground/40 ml-auto font-mono truncate max-w-14">
          {node.id.slice(-8)}
        </span>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="border-l border-border/15 ml-5">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeViewer({ root, selectedNodeId, onSelectNode }: TreeViewerProps) {
  const [search, setSearch] = useState('');

  // Filter tree nodes by search
  const filterTree = (node: SemanticExportNode, query: string): SemanticExportNode | null => {
    if (!query) return node;
    const q = query.toLowerCase();
    const matchesSelf =
      node.type.toLowerCase().includes(q) ||
      node.role.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q);
    const filteredChildren = node.children
      .map((c) => filterTree(c, q))
      .filter(Boolean) as SemanticExportNode[];
    if (matchesSelf || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  const filteredRoot = root && search ? filterTree(root, search) : root;

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-border/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Semantic Tree
          </h2>
          {root && (
            <span className="text-[9px] text-muted-foreground font-mono">
              {root.children.length} children
            </span>
          )}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter nodes..."
          className="h-6 text-[11px] bg-muted/30 border-border/30"
        />
      </div>

      {/* Tree content */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredRoot ? (
            <TreeNodeRow
              node={filteredRoot}
              selectedId={selectedNodeId}
              onSelect={onSelectNode}
              depth={0}
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
              {search ? 'No matching nodes' : 'No tree loaded'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
