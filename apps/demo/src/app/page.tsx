/**
 * STRA Demo - 产品展示橱窗
 *
 * "STRA 做出来的应用长什么样"
 *
 * 三个交互式展示：
 * 1. AI Copilot — 聊天式 AI 界面（琥珀黄系）
 * 2. Analytics Dashboard — 实时数据仪表盘（翠绿系）
 * 3. Action Flow — 交互式工作流（深靛蓝系）
 */

'use client';

import { useState, useEffect } from 'react';
import { CopilotDemo } from '@/components/showcase/copilot-demo';
import { DashboardDemo } from '@/components/showcase/dashboard-demo';
import { FlowDemo } from '@/components/showcase/flow-demo';

// ============================================================
// Types
// ============================================================

type ShowcaseTab = 'copilot' | 'dashboard' | 'flow';

interface TabConfig {
  id: ShowcaseTab;
  label: string;
  accent: string;
  icon: string;
  description: string;
}

// ============================================================
// Config
// ============================================================

const TABS: TabConfig[] = [
  {
    id: 'copilot',
    label: 'AI Copilot',
    accent: '#f0a500',
    icon: '🤖',
    description: 'Signal-driven AI conversation interface',
  },
  {
    id: 'dashboard',
    label: 'Analytics',
    accent: '#00b894',
    icon: '📊',
    description: 'Real-time semantic metrics dashboard',
  },
  {
    id: 'flow',
    label: 'Action Flow',
    accent: '#1a1a2e',
    icon: '⚡',
    description: 'Interactive action-dispatch pipeline',
  },
];

// ============================================================
// Component
// ============================================================

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('copilot');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/stra-logo.svg" alt="STRA" className="h-8 opacity-60" />
          <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading STRA Runtime...</div>
        </div>
      </div>
    );
  }

  const activeConfig = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ===== Hero Section ===== */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="flex items-center gap-3 mb-3">
            <img src="/stra-logo.svg" alt="STRA" className="h-8" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Demo
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">Semantic Tree Runtime + AI</p>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            让 AI 第一次真正读懂 UI。通过语义树运行时，将界面结构转化为 AI 可理解、可操作、可推理的语义层。
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Nodes', value: 'Semantic Identity', color: '#1a1a2e' },
              { label: 'Signals', value: 'Reactive State', color: '#00b894' },
              { label: 'Actions', value: 'Intent Dispatch', color: '#f0a500' },
              { label: 'Flush', value: 'Deterministic Update', color: '#888' },
            ].map(feat => (
              <div
                key={feat.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-[10px]"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: feat.color }} />
                <span className="font-medium font-mono" style={{ color: feat.color }}>
                  {feat.label}
                </span>
                <span className="text-muted-foreground">{feat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ===== Tab Navigation ===== */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-b-[2px] font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={{
                  borderBottomColor: activeTab === tab.id ? tab.accent : 'transparent',
                  color: activeTab === tab.id ? tab.accent : undefined,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Showcase Area ===== */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Tab Description */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: activeConfig.accent }} />
            <span className="text-[10px] font-mono text-muted-foreground">{activeConfig.description}</span>
          </div>

          {/* Demo Panel */}
          <div
            className="rounded-2xl border bg-card overflow-hidden"
            style={{ borderColor: `${activeConfig.accent}20` }}
          >
            <div className="h-[480px]">
              {activeTab === 'copilot' && <CopilotDemo />}
              {activeTab === 'dashboard' && <DashboardDemo />}
              {activeTab === 'flow' && <FlowDemo />}
            </div>
          </div>

          {/* Architecture Note */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              {
                title: 'STRA Core',
                desc: '语义树是唯一状态源。Node → Signal → Action 构成完整的数据-行为闭环。',
                color: '#1a1a2e',
              },
              {
                title: 'Signal Reactivity',
                desc: 'Signal 变更自动传播到依赖图，Dirty System 精准标记受影响节点。',
                color: '#00b894',
              },
              {
                title: 'Action Dispatch',
                desc: '用户交互通过 Action 语义化派发，Flush 管线保证确定性更新。',
                color: '#f0a500',
              },
            ].map(card => (
              <div
                key={card.title}
                className="p-4 rounded-xl border border-border bg-card/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                  <h4 className="text-xs font-medium" style={{ color: card.color }}>
                    {card.title}
                  </h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/stra-logo.svg" alt="STRA" className="h-4" />
            <span className="text-[10px] font-mono text-muted-foreground">
              v0.1.0 · Semantic Tree Runtime + AI
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/50">
            Nodes · Signals · Actions · Flush
          </span>
        </div>
      </footer>
    </div>
  );
}
