/**
 * Interactive Flow Showcase - 展示 STRA Action 驱动的交互流程
 *
 * 展示一个多步骤工作流：
 * - 用户通过 Action 触发状态变更
 * - Signal 自动传播依赖更新
 * - Dirty 系统标记受影响节点
 * - Flush 管线执行更新
 *
 * 模拟一个"数据处理流水线"场景
 */

'use client';

import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ============================================================
// Types
// ============================================================

type FlowStep = 'idle' | 'ingest' | 'transform' | 'validate' | 'render' | 'complete';

interface FlowNode {
  id: string;
  label: string;
  type: 'input' | 'process' | 'output';
  signal: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

// ============================================================
// Flow Definition
// ============================================================

const FLOW_NODES: FlowNode[] = [
  { id: 'src-data', label: 'Data Source', type: 'input', signal: 'signal:raw-data', status: 'pending' },
  { id: 'node-parse', label: 'Semantic Parse', type: 'process', signal: 'signal:parsed', status: 'pending' },
  { id: 'node-transform', label: 'AI Transform', type: 'process', signal: 'signal:transformed', status: 'pending' },
  { id: 'node-validate', label: 'Validation', type: 'process', signal: 'signal:validated', status: 'pending' },
  { id: 'node-render', label: 'Render Output', type: 'output', signal: 'signal:rendered', status: 'pending' },
  { id: 'dst-ui', label: 'UI Display', type: 'output', signal: 'signal:display', status: 'pending' },
];

const FLOW_CONNECTIONS: [string, string][] = [
  ['src-data', 'node-parse'],
  ['node-parse', 'node-transform'],
  ['node-transform', 'node-validate'],
  ['node-validate', 'node-render'],
  ['node-render', 'dst-ui'],
];

// ============================================================
// Component
// ============================================================

export function FlowDemo() {
  const [nodes, setNodes] = useState<FlowNode[]>(FLOW_NODES);
  const [currentStep, setCurrentStep] = useState<FlowStep>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-8), msg]);
  }, []);

  const resetFlow = useCallback(() => {
    setNodes(FLOW_NODES.map(n => ({ ...n, status: 'pending' })));
    setCurrentStep('idle');
    setActiveNodeId(null);
    setLogs([]);
  }, []);

  const runFlow = useCallback(async () => {
    setCurrentStep('ingest');
    addLog('▶ Action dispatched: flow:start');

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      setActiveNodeId(node.id);
      addLog(`⚡ Signal: ${node.signal} → propagating`);

      // Activate
      setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, status: 'active' } : n)));
      await delay(600);

      // Mark dependents dirty
      const deps = FLOW_CONNECTIONS.filter(([from]) => from === node.id);
      if (deps.length > 0) {
        addLog(`🔴 Dirty: ${deps.map(([, to]) => to).join(', ')} (signal-change)`);
      }

      // Complete
      setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, status: 'done' } : n)));
      addLog(`✓ ${node.label} complete → ${node.signal} updated`);
      await delay(300);
    }

    setActiveNodeId(null);
    setCurrentStep('complete');
    addLog('✓ Flush complete — all nodes updated');
  }, [nodes, addLog]);

  const getNodeColor = (node: FlowNode): string => {
    if (node.id === activeNodeId) return '#f0a500';
    if (node.status === 'done') return '#00b894';
    if (node.status === 'active') return '#f0a500';
    if (node.status === 'error') return '#e74c3c';
    return '#555';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]/30">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#1a1a2e] dark:text-[#8888cc]">Action Flow</h3>
          <Badge variant="outline" className="text-[10px] border-[#1a1a2e]/30 dark:border-[#8888cc]/30 text-[#1a1a2e] dark:text-[#8888cc]">
            {currentStep === 'idle' ? 'READY' : currentStep === 'complete' ? 'DONE' : 'RUNNING'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFlow}
            className="text-[10px] hover:bg-[#1a1a2e]/5 dark:hover:bg-[#8888cc]/10"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={runFlow}
            disabled={currentStep !== 'idle' && currentStep !== 'complete'}
            className="text-[10px] bg-[#1a1a2e] hover:bg-[#1a1a2e]/80 dark:bg-[#8888cc] dark:hover:bg-[#8888cc]/80 text-white"
          >
            Run Flow
          </Button>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {nodes.map((node, idx) => (
            <div key={node.id} className="flex items-center">
              {/* Node */}
              <div
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                  node.id === activeNodeId ? 'scale-110' : ''
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                    node.status === 'done'
                      ? 'border-[#00b894] bg-[#00b894]/10'
                      : node.status === 'active'
                      ? 'border-[#f0a500] bg-[#f0a500]/10 animate-pulse'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="text-xs font-mono" style={{ color: getNodeColor(node) }}>
                    {node.type === 'input' ? '📥' : node.type === 'output' ? '📤' : '⚙️'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground text-center max-w-[56px] leading-tight">
                  {node.label}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground/50">
                  {node.status === 'done' ? '✓' : node.status === 'active' ? '●' : '○'}
                </span>
              </div>
              {/* Connector */}
              {idx < nodes.length - 1 && (
                <div className="mx-1 flex items-center">
                  <div
                    className={`h-0.5 w-6 transition-colors duration-300 ${
                      node.status === 'done' ? 'bg-[#00b894]' : 'bg-border'
                    }`}
                  />
                  <div
                    className={`text-[8px] transition-colors duration-300 ${
                      node.status === 'done' ? 'text-[#00b894]' : 'text-border'
                    }`}
                  >
                    ▸
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signal Map */}
      <div className="px-4 pb-3">
        <div className="text-[10px] text-muted-foreground mb-2">Signal Dependency Graph</div>
        <div className="space-y-1">
          {FLOW_CONNECTIONS.map(([from, to], idx) => {
            const fromNode = nodes.find(n => n.id === from);
            const toNode = nodes.find(n => n.id === to);
            const active = fromNode?.status === 'done' && toNode?.status !== 'pending';
            return (
              <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
                <span className={`w-2 h-2 rounded-full ${active ? 'bg-[#00b894]' : 'bg-border'}`} />
                <span className="text-muted-foreground">{from}</span>
                <span className="text-muted-foreground/50">→</span>
                <span className={active ? 'text-[#00b894]' : 'text-muted-foreground'}>{to}</span>
                <span className="text-muted-foreground/30 ml-auto">{active ? 'propagated' : 'pending'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Log */}
      <div className="flex-1 px-4 pb-4 overflow-auto">
        <div className="text-[10px] text-muted-foreground mb-2">Action Log</div>
        <div className="space-y-1">
          {logs.map((log, idx) => (
            <div key={idx} className="text-[10px] font-mono text-muted-foreground/70">
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-[10px] text-muted-foreground/30 italic">Click "Run Flow" to start...</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
