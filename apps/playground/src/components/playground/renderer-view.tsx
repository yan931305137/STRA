'use client';

import React from 'react';
import type { SemanticExportNode } from '@stra/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// ============================================================
// Pure Renderer - transforms STRA tree into visual HTML preview
//
// CONSTRAINT: Renderer must be a PURE FUNCTION of the tree.
// No state mutations, no side effects.
// ============================================================

const ROLE_STYLES: Record<string, string> = {
  page: 'bg-indigo-500/5 border-indigo-500/20',
  header: 'bg-blue-500/5 border-blue-500/20',
  footer: 'bg-blue-500/5 border-blue-500/20',
  nav: 'bg-cyan-500/5 border-cyan-500/20',
  navigation: 'bg-cyan-500/5 border-cyan-500/20',
  main: 'bg-indigo-500/5 border-indigo-500/20',
  section: 'bg-violet-500/5 border-violet-500/20',
  list: 'bg-teal-500/5 border-teal-500/20',
  item: 'bg-emerald-500/5 border-emerald-500/20',
  button: 'bg-amber-500/10 border-amber-500/25',
  field: 'bg-pink-500/5 border-pink-500/20',
  form: 'bg-pink-500/5 border-pink-500/20',
  text: 'bg-slate-500/5 border-slate-500/20',
  image: 'bg-rose-500/5 border-rose-500/20',
  container: 'bg-gray-500/5 border-gray-500/20',
  card: 'bg-emerald-500/5 border-emerald-500/20',
  sidebar: 'bg-indigo-500/5 border-indigo-500/20',
};

const ROLE_LABEL_COLORS: Record<string, string> = {
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
  form: 'text-pink-400',
  text: 'text-slate-400',
  image: 'text-rose-400',
  container: 'text-gray-400',
  card: 'text-emerald-400',
  sidebar: 'text-indigo-400',
};

function RenderedNode({
  node,
  selectedNodeId,
  onSelectNode,
}: {
  node: SemanticExportNode;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const isSelected = selectedNodeId === node.id;
  const isSuspended = node.phase === 'suspended';
  const styleClass = ROLE_STYLES[node.role] || 'bg-gray-500/5 border-gray-500/20';
  const labelColor = ROLE_LABEL_COLORS[node.role] || 'text-gray-400';

  // Get label from schema
  const label = (node.schema?.label as string) || (node.schema?.name as string) || node.type;

  return (
    <div
      className={`border rounded-md p-2 transition-all cursor-pointer ${
        styleClass
      } ${isSelected ? 'ring-1 ring-emerald-400/50' : ''} ${
        isSuspended ? 'opacity-40' : ''
      }`}
      onClick={() => onSelectNode(node.id)}
    >
      {/* Node header */}
      <div className="flex items-center gap-1.5 mb-1">
        <Badge
          variant="outline"
          className={`text-[8px] px-1 py-0 h-3.5 ${labelColor} border-current/20`}
        >
          {node.role}
        </Badge>
        <span className="text-[11px] font-mono font-medium text-foreground truncate">
          {label}
        </span>
        {node.phase !== 'active' && (
          <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 text-amber-400 border-amber-400/20 ml-auto">
            {node.phase}
          </Badge>
        )}
      </div>

      {/* Schema display for key fields */}
      {node.schema && Object.keys(node.schema).length > 0 && (
        <div className="text-[9px] text-muted-foreground space-y-0.5 mb-1">
          {Object.entries(node.schema)
            .filter(([k]) => !['stepName', 'workflowName'].includes(k))
            .slice(0, 3)
            .map(([key, val]) => (
              <div key={key} className="flex gap-1">
                <span className="text-muted-foreground/60">{key}:</span>
                <span className="font-mono truncate">{JSON.stringify(val)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Signal values */}
      {node.signals && Object.keys(node.signals).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {Object.entries(node.signals).map(([name, val]) => (
            <span
              key={name}
              className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded"
            >
              {name}={JSON.stringify(val)}
            </span>
          ))}
        </div>
      )}

      {/* Children */}
      {node.children.length > 0 && (
        <div className={`space-y-1.5 ${
          node.role === 'page' || node.role === 'section'
            ? 'mt-1.5'
            : 'mt-1'
        } ${node.styles?.layout === 'vertical' ? 'flex flex-col' : ''} ${
          node.role === 'nav' || node.role === 'navigation'
            ? 'flex flex-row gap-1 flex-wrap'
            : ''
        }`}>
          {node.children.map((child) => (
            <RenderedNode
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Renderer View
// ============================================================

interface RendererViewProps {
  root: SemanticExportNode | null;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export function RendererView({ root, selectedNodeId, onSelectNode }: RendererViewProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-border/40">
        <h2 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Rendered Output
          <span className="text-[9px] font-normal text-muted-foreground ml-1">
            pure function of tree
          </span>
        </h2>
      </div>

      {/* Rendered content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {root ? (
            <RenderedNode
              node={root}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
              No tree to render
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
