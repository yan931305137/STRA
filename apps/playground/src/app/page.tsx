'use client';

import React, { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useSTRACore as useSTRCore } from '@/hooks/use-stra-core';
import { findNodeInTree } from '@/lib/stra-runtime';
import { TreeViewer } from '@/components/playground/tree-viewer';
import { ActionPanel } from '@/components/playground/action-panel';
import { RendererView } from '@/components/playground/renderer-view';
import { DebugInspector } from '@/components/playground/debug-inspector';
import type { NodeId, SemanticRole, SemanticIntent } from '@stra/types';

// ============================================================
// STRA Playground - Main Page
//
// STRICT: @stra/core is the ONLY state source of truth.
// useState is ONLY used for UI-only state (selectedNodeId).
// All tree/stats/signals/actions come from STRA core.
// ============================================================

export default function STRPlayground() {
  const {
    snapshot,
    mounted,
    addChild,
    removeNode,
    setSignal,
    suspendNode,
    resumeNode,
    resetRuntime,
  } = useSTRCore();

  // UI-only state (not application state — selected node is a view concern)
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);

  // Derive selected node from STRA core snapshot
  const selectedNode = findNodeInTree(snapshot.tree.root, selectedNodeId || '');

  // ============================================================
  // Action handlers - all mutations go through STRA core
  // ============================================================

  const handleAddChild = useCallback(
    (parentId: NodeId, options: {
      type: string;
      role?: SemanticRole;
      intent?: SemanticIntent;
      schema?: Record<string, unknown>;
      signals?: Record<string, unknown>;
    }) => {
      addChild(parentId, options);
    },
    [addChild],
  );

  const handleRemove = useCallback(
    (nodeId: NodeId) => {
      removeNode(nodeId);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [removeNode, selectedNodeId],
  );

  const handleSetSignal = useCallback(
    (nodeId: NodeId, name: string, value: unknown) => {
      setSignal(nodeId, name, value);
    },
    [setSignal],
  );

  const handleSuspend = useCallback(
    (nodeId: NodeId) => {
      suspendNode(nodeId);
    },
    [suspendNode],
  );

  const handleResume = useCallback(
    (nodeId: NodeId) => {
      resumeNode(nodeId);
    },
    [resumeNode],
  );

  const handleReset = useCallback(() => {
    resetRuntime();
    setSelectedNodeId(null);
  }, [resetRuntime]);

  // ============================================================
  // Loading state
  // ============================================================

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <img src="/stra-logo.svg" alt="STRA" className="h-6 opacity-50" />
          <span className="text-xs text-muted-foreground">Initializing STRA Runtime...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // Main render
  // ============================================================

  const { tree, stats, dirtyRecords, actionLog, signalGraph } = snapshot;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Header Bar ── */}
      <header className="border-b border-border/40 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/stra-logo.svg" alt="STRA" className="h-6" />
          <span className="text-muted-foreground font-normal text-base">Playground</span>
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 text-muted-foreground">
            core-only
          </Badge>
        </div>

        {/* Runtime stats - derived from STRA core */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
          <span>
            Nodes <span className="text-foreground font-medium">{tree.stats.totalNodes}</span>
          </span>
          <span>
            Active <span className="text-emerald-400 font-medium">{tree.stats.activeNodes}</span>
          </span>
          <span>
            Signals <span className="text-emerald-400 font-medium">{tree.stats.signalCount}</span>
          </span>
          <span>
            Relations <span className="text-violet-400 font-medium">{tree.stats.relationCount}</span>
          </span>
          <span>
            Dirty <span className="text-amber-400 font-medium">{stats.dirtyCount as number}</span>
          </span>
          <span>
            Flushes <span className="text-muted-foreground font-medium">{stats.flushCount as number}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      </header>

      {/* ── Main Layout: 4 resizable panels ── */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="vertical">
          {/* Top row: Tree | Action | Renderer */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <ResizablePanelGroup orientation="horizontal">
              {/* Left: Tree Viewer */}
              <ResizablePanel defaultSize={28} minSize={18}>
                <TreeViewer
                  root={tree.root}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Middle: Action Panel */}
              <ResizablePanel defaultSize={32} minSize={20}>
                <ActionPanel
                  selectedNode={selectedNode}
                  selectedNodeId={selectedNodeId}
                  onSuspend={handleSuspend}
                  onResume={handleResume}
                  onRemove={handleRemove}
                  onSetSignal={handleSetSignal}
                  onAddChild={handleAddChild}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right: Renderer View */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <RendererView
                  root={tree.root}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Bottom: Debug Inspector */}
          <ResizablePanel defaultSize={30} minSize={15}>
            <DebugInspector
              signals={signalGraph}
              actionLog={[...actionLog]}
              dirtyRecords={dirtyRecords}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
