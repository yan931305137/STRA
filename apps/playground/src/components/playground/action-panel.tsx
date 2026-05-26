'use client';

import React, { useState } from 'react';
import type { SemanticExportNode, SemanticRole, SemanticIntent } from '@stra/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ============================================================
// Color Maps (same as tree-viewer)
// ============================================================

const PHASE_COLORS: Record<string, string> = {
  created: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  attached: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  suspended: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  detached: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const ROLE_COLORS: Record<string, string> = {
  page: 'bg-indigo-500/15 text-indigo-400',
  header: 'bg-blue-500/15 text-blue-400',
  footer: 'bg-blue-500/15 text-blue-400',
  nav: 'bg-cyan-500/15 text-cyan-400',
  section: 'bg-violet-500/15 text-violet-400',
  list: 'bg-teal-500/15 text-teal-400',
  item: 'bg-emerald-500/15 text-emerald-400',
  button: 'bg-amber-500/15 text-amber-400',
  field: 'bg-pink-500/15 text-pink-400',
  form: 'bg-pink-500/15 text-pink-400',
  container: 'bg-gray-500/15 text-gray-400',
};

// ============================================================
// Node Inspector (selected node detail)
// ============================================================

interface NodeInspectorProps {
  node: SemanticExportNode | null;
  onSuspend: (nodeId: string) => void;
  onResume: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onSetSignal: (nodeId: string, name: string, value: unknown) => void;
}

function NodeInspector({ node, onSuspend, onResume, onRemove, onSetSignal }: NodeInspectorProps) {
  const [signalEdit, setSignalEdit] = useState<Record<string, string>>({});

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Select a node in the tree to inspect
      </div>
    );
  }

  const phaseColor = PHASE_COLORS[node.phase] || 'bg-gray-500/15 text-gray-400';
  const roleColor = ROLE_COLORS[node.role] || 'bg-gray-500/15 text-gray-400';

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Node identity */}
        <div>
          <h3 className="text-sm font-semibold font-mono text-amber-400">{node.type}</h3>
          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{node.id}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${phaseColor}`}>
            {node.phase}
          </Badge>
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${roleColor}`}>
            {node.role}
          </Badge>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/15 text-violet-400">
            {node.intent}
          </Badge>
        </div>

        <Separator className="opacity-30" />

        {/* Signals */}
        {Object.keys(node.signals).length > 0 && (
          <div>
            <Label className="text-[10px] text-emerald-400 mb-1.5 block flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Signals
            </Label>
            <div className="space-y-1">
              {Object.entries(node.signals).map(([name, value]) => (
                <div key={name} className="flex items-center gap-1.5 bg-muted/25 rounded px-2 py-1 text-xs">
                  <span className="font-mono text-muted-foreground text-[10px] shrink-0">{name}:</span>
                  <Input
                    value={signalEdit[name] ?? JSON.stringify(value)}
                    onChange={(e) => setSignalEdit((prev) => ({ ...prev, [name]: e.target.value }))}
                    onBlur={() => {
                      const raw = signalEdit[name];
                      if (raw !== undefined) {
                        try {
                          const parsed = JSON.parse(raw);
                          onSetSignal(node.id, name, parsed);
                        } catch {
                          onSetSignal(node.id, name, raw);
                        }
                        setSignalEdit((prev) => {
                          const next = { ...prev };
                          delete next[name];
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="h-5 text-[10px] font-mono bg-transparent border-0 p-0 flex-1 min-w-0 focus-visible:ring-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schema */}
        {Object.keys(node.schema).length > 0 && (
          <div>
            <Label className="text-[10px] text-slate-400 mb-1 block">Schema</Label>
            <pre className="bg-muted/25 rounded p-2 text-[10px] font-mono overflow-x-auto max-h-32 text-muted-foreground">
              {JSON.stringify(node.schema, null, 2)}
            </pre>
          </div>
        )}

        <Separator className="opacity-30" />

        {/* Actions */}
        <div>
          <Label className="text-[10px] text-amber-400 mb-1.5 block flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-amber-400" />
            Node Actions
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {node.phase === 'active' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => onSuspend(node.id)}
              >
                Suspend
              </Button>
            )}
            {node.phase === 'suspended' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => onResume(node.id)}
              >
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => onRemove(node.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Add Node Form
// ============================================================

interface AddNodeFormProps {
  parentNodeId: string | null;
  onAddChild: (parentId: string, options: {
    type: string;
    role?: SemanticRole;
    intent?: SemanticIntent;
    schema?: Record<string, unknown>;
    signals?: Record<string, unknown>;
  }) => void;
}

const ROLES: SemanticRole[] = ['page', 'section', 'header', 'footer', 'nav', 'main', 'list', 'item', 'form', 'field', 'button', 'text', 'image', 'container', 'card', 'sidebar'];
const INTENTS: SemanticIntent[] = ['display', 'input', 'action', 'navigation', 'layout', 'feedback', 'data', 'payment', 'validation', 'workflow'];

function AddNodeForm({ parentNodeId, onAddChild }: AddNodeFormProps) {
  const [nodeType, setNodeType] = useState('CustomNode');
  const [role, setRole] = useState<SemanticRole>('container');
  const [intent, setIntent] = useState<SemanticIntent>('display');
  const [schemaJson, setSchemaJson] = useState('');
  const [signalJson, setSignalJson] = useState('');

  if (!parentNodeId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Select a parent node to add children
      </div>
    );
  }

  const handleAdd = () => {
    let schema: Record<string, unknown> | undefined;
    let signals: Record<string, unknown> | undefined;

    if (schemaJson.trim()) {
      try { schema = JSON.parse(schemaJson); } catch { /* invalid */ }
    }
    if (signalJson.trim()) {
      try { signals = JSON.parse(signalJson); } catch { /* invalid */ }
    }

    onAddChild(parentNodeId, { type: nodeType, role, intent, schema, signals });
    setSchemaJson('');
    setSignalJson('');
  };

  return (
    <div className="p-3 space-y-2.5">
      <Label className="text-[10px] text-amber-400 flex items-center gap-1">
        <span className="w-1 h-1 rounded-full bg-amber-400" />
        Add Node to {parentNodeId.slice(-8)}
      </Label>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Type</Label>
          <Input
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
            className="h-6 text-[11px] bg-muted/25 border-border/30"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as SemanticRole)}>
            <SelectTrigger className="h-6 text-[11px] bg-muted/25 border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="text-[11px]">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] text-muted-foreground">Intent</Label>
        <Select value={intent} onValueChange={(v) => setIntent(v as SemanticIntent)}>
          <SelectTrigger className="h-6 text-[11px] bg-muted/25 border-border/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTENTS.map((i) => (
              <SelectItem key={i} value={i} className="text-[11px]">{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] text-muted-foreground">Schema (JSON)</Label>
        <Textarea
          value={schemaJson}
          onChange={(e) => setSchemaJson(e.target.value)}
          placeholder='{"label": "My Node"}'
          className="min-h-10 text-[10px] font-mono bg-muted/25 border-border/30"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] text-muted-foreground">Signals (JSON)</Label>
        <Textarea
          value={signalJson}
          onChange={(e) => setSignalJson(e.target.value)}
          placeholder='{"count": 0}'
          className="min-h-10 text-[10px] font-mono bg-muted/25 border-border/30"
        />
      </div>

      <Button
        size="sm"
        className="w-full h-7 text-[11px] bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
        onClick={handleAdd}
        disabled={!nodeType.trim()}
      >
        Add Node
      </Button>
    </div>
  );
}

// ============================================================
// Action Panel (combines inspector + add form)
// ============================================================

interface ActionPanelProps {
  selectedNode: SemanticExportNode | null;
  selectedNodeId: string | null;
  onSuspend: (nodeId: string) => void;
  onResume: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onSetSignal: (nodeId: string, name: string, value: unknown) => void;
  onAddChild: (parentId: string, options: {
    type: string;
    role?: SemanticRole;
    intent?: SemanticIntent;
    schema?: Record<string, unknown>;
    signals?: Record<string, unknown>;
  }) => void;
}

export function ActionPanel({
  selectedNode,
  selectedNodeId,
  onSuspend,
  onResume,
  onRemove,
  onSetSignal,
  onAddChild,
}: ActionPanelProps) {
  const [tab, setTab] = useState<'inspect' | 'add'>('inspect');

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <button
          className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
            tab === 'inspect'
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('inspect')}
        >
          Inspect
        </button>
        <button
          className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
            tab === 'add'
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('add')}
        >
          Add Node
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'inspect' ? (
          <NodeInspector
            node={selectedNode}
            onSuspend={onSuspend}
            onResume={onResume}
            onRemove={onRemove}
            onSetSignal={onSetSignal}
          />
        ) : (
          <AddNodeForm parentNodeId={selectedNodeId} onAddChild={onAddChild} />
        )}
      </div>
    </div>
  );
}
