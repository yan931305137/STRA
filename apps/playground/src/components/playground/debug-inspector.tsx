'use client';

import React, { useState } from 'react';
import type { DirtyRecord, ActionResult } from '@stra/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================================
// Signal Graph Panel
// ============================================================

interface SignalEntry {
  signalId: string;
  subscriberCount: number;
  subscribers: string[];
}

function SignalGraphPanel({ signals }: { signals: SignalEntry[] }) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4">
        No active signal subscriptions
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {signals.map((entry) => {
          const parts = entry.signalId.split(':');
          const nodeId = parts[0];
          const signalName = parts.slice(1).join(':');

          return (
            <div
              key={entry.signalId}
              className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1 text-xs group"
            >
              {/* Signal pulse indicator */}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse shrink-0" />

              <span className="font-mono text-emerald-400 shrink-0">{signalName}</span>
              <span className="text-muted-foreground text-[9px] truncate">
                ← {nodeId.slice(-8)}
              </span>

              {entry.subscriberCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[8px] px-1 py-0 h-3.5 ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0"
                >
                  {entry.subscriberCount} subs
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Action Log Panel
// ============================================================

interface ActionLogEntry {
  actionId: string;
  actionType: string;
  nodeId: string;
  intent: string;
  payload: Record<string, unknown>;
  result: ActionResult;
  timestamp: number;
}

function ActionLogPanel({ actions }: { actions: ActionLogEntry[] }) {
  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4">
        No actions dispatched yet
      </div>
    );
  }

  const recentActions = [...actions].reverse().slice(0, 50);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {recentActions.map((action) => (
          <div
            key={action.actionId}
            className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
              action.result.success
                ? 'bg-amber-500/5 border border-amber-500/10'
                : 'bg-red-500/5 border border-red-500/10'
            }`}
          >
            {/* Status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                action.result.success ? 'bg-amber-400' : 'bg-red-400'
              }`}
            />

            <span className="font-mono text-amber-400 shrink-0">{action.actionType}</span>

            <span className="text-muted-foreground text-[9px] truncate">
              → {action.nodeId.slice(-8)}
            </span>

            {action.result.success && action.result.mutations.length > 0 && (
              <Badge
                variant="outline"
                className="text-[7px] px-1 py-0 h-3 ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 shrink-0"
              >
                {action.result.mutations.length} mutated
              </Badge>
            )}

            {!action.result.success && action.result.error && (
              <span className="text-[8px] text-red-400 truncate ml-auto">
                {action.result.error}
              </span>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Dirty Nodes Panel
// ============================================================

function DirtyNodesPanel({ dirtyRecords }: { dirtyRecords: DirtyRecord[] }) {
  if (dirtyRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4">
        No dirty nodes — tree is clean
      </div>
    );
  }

  const CATEGORY_COLORS: Record<string, string> = {
    structural: 'text-amber-400',
    value: 'text-blue-400',
    lifecycle: 'text-violet-400',
    dependency: 'text-cyan-400',
    action: 'text-red-400',
    propagation: 'text-emerald-400',
    manual: 'text-gray-400',
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {dirtyRecords.map((record, i) => (
          <div
            key={`${record.nodeId}-${i}`}
            className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1 text-xs"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              CATEGORY_COLORS[record.category] || 'bg-gray-400'
            } bg-current`} />

            <span className="font-mono text-foreground truncate">{record.nodeId.slice(-8)}</span>

            <Badge
              variant="outline"
              className={`text-[8px] px-1 py-0 h-3 ${CATEGORY_COLORS[record.category] || 'text-gray-400'}`}
            >
              {record.category}
            </Badge>

            <span className="text-[9px] text-muted-foreground truncate">
              {record.reason}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Debug Inspector (combines all debug views)
// ============================================================

interface DebugInspectorProps {
  signals: Array<{ signalId: string; subscriberCount: number; subscribers: string[] }>;
  actionLog: ActionLogEntry[];
  dirtyRecords: DirtyRecord[];
}

export function DebugInspector({ signals, actionLog, dirtyRecords }: DebugInspectorProps) {
  const [activeTab, setActiveTab] = useState('signals');

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-3">
        <h2 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Debug Inspector
        </h2>

        <div className="flex items-center gap-1 ml-auto text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            {signals.length} signals
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-amber-400" />
            {actionLog.length} actions
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-red-400" />
            {dirtyRecords.length} dirty
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none h-7 bg-transparent px-2 border-b border-border/20 gap-0">
          <TabsTrigger value="signals" className="text-[10px] h-5 px-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            Signals
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-[10px] h-5 px-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
            Actions
          </TabsTrigger>
          <TabsTrigger value="dirty" className="text-[10px] h-5 px-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
            Dirty
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="flex-1 overflow-hidden m-0">
          <SignalGraphPanel signals={signals} />
        </TabsContent>

        <TabsContent value="actions" className="flex-1 overflow-hidden m-0">
          <ActionLogPanel actions={actionLog} />
        </TabsContent>

        <TabsContent value="dirty" className="flex-1 overflow-hidden m-0">
          <DirtyNodesPanel dirtyRecords={dirtyRecords} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
