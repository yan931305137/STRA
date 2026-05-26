/**
 * Analytics Dashboard Showcase - 展示 STRA 驱动的实时数据仪表盘
 *
 * 用 STRA signal 管理：
 * - 各指标实时数值
 * - 图表数据源
 * - 告警状态
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ============================================================
// Types
// ============================================================

interface MetricData {
  label: string;
  value: string;
  change: number;
  signal: string;
  color: string;
}

interface ChartBar {
  label: string;
  value: number;
  color: string;
}

// ============================================================
// Demo Data
// ============================================================

const INITIAL_METRICS: MetricData[] = [
  { label: 'Active Nodes', value: '1,284', change: 12.5, signal: 'node:active', color: '#1a1a2e' },
  { label: 'Signal Flux', value: '3.2K/s', change: 8.3, signal: 'signal:flux', color: '#00b894' },
  { label: 'Flush Latency', value: '0.8ms', change: -15.2, signal: 'flush:latency', color: '#f0a500' },
  { label: 'Dirty Nodes', value: '23', change: -42.1, signal: 'dirty:count', color: '#e74c3c' },
];

const CHART_DATA: ChartBar[] = [
  { label: 'Mon', value: 65, color: '#1a1a2e' },
  { label: 'Tue', value: 78, color: '#1a1a2e' },
  { label: 'Wed', value: 90, color: '#00b894' },
  { label: 'Thu', value: 81, color: '#1a1a2e' },
  { label: 'Fri', value: 95, color: '#00b894' },
  { label: 'Sat', value: 56, color: '#1a1a2e' },
  { label: 'Sun', value: 72, color: '#1a1a2e' },
];

const ACTIVITY_LOG = [
  { time: '2s ago', event: 'signal:update', node: 'dashboard:metric-users', detail: '12,847 → 12,903' },
  { time: '5s ago', event: 'flush:complete', node: '-', detail: '23 tasks, 0.8ms' },
  { time: '12s ago', event: 'action:dispatch', node: 'dashboard:refresh', detail: 'type=periodic' },
  { time: '18s ago', event: 'signal:update', node: 'dashboard:metric-growth', detail: '22.1% → 23.5%' },
  { time: '30s ago', event: 'dirty:mark', node: 'dashboard:chart-data', detail: 'reason=signal-change' },
];

// ============================================================
// Component
// ============================================================

export function DashboardDemo() {
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [selectedMetric, setSelectedMetric] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [tick, setTick] = useState(0);

  // Simulate live data updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setMetrics(prev =>
        prev.map(m => ({
          ...m,
          value: fluctuateValue(m.value, m.signal),
          change: Number((m.change + (Math.random() - 0.5) * 2).toFixed(1)),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  const handleToggleLive = useCallback(() => {
    setIsLive(v => !v);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#00b894]/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00b894] animate-pulse" />
          <h3 className="text-sm font-medium text-[#00b894]">Analytics</h3>
          <Badge variant="outline" className="text-[10px] border-[#00b894]/30 text-[#00b894]">
            {isLive ? 'LIVE' : 'PAUSED'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleLive}
          className="text-[10px] text-[#00b894] hover:text-[#00b894] hover:bg-[#00b894]/10"
        >
          {isLive ? 'Pause' : 'Resume'}
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 p-4">
        {metrics.map((metric, idx) => (
          <button
            key={metric.signal}
            onClick={() => setSelectedMetric(selectedMetric === idx ? null : idx)}
            className={`text-left p-3 rounded-xl border transition-all ${
              selectedMetric === idx
                ? 'border-[#00b894]/40 bg-[#00b894]/5'
                : 'border-border bg-card hover:border-[#00b894]/20'
            }`}
          >
            <div className="text-[10px] text-muted-foreground font-mono">{metric.signal}</div>
            <div className="text-lg font-medium font-mono mt-0.5" style={{ color: metric.color }}>
              {metric.value}
            </div>
            <div className={`text-[10px] font-mono ${metric.change >= 0 ? 'text-[#00b894]' : 'text-[#e74c3c]'}`}>
              {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
            </div>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 pb-3">
        <div className="text-[10px] text-muted-foreground mb-2">Signal Flux / 7 days</div>
        <div className="flex items-end gap-1 h-20">
          {CHART_DATA.map((bar, idx) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all duration-700"
                style={{
                  height: `${bar.value}%`,
                  backgroundColor: bar.color,
                  opacity: 0.6 + (bar.value / 100) * 0.4,
                }}
              />
              <span className="text-[8px] text-muted-foreground font-mono">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Log */}
      <div className="flex-1 px-4 pb-4 overflow-auto">
        <div className="text-[10px] text-muted-foreground mb-2">Runtime Activity</div>
        <div className="space-y-1.5">
          {ACTIVITY_LOG.map((log, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-muted-foreground/60 w-14 shrink-0">{log.time}</span>
              <Badge
                variant="outline"
                className="text-[8px] px-1 py-0 h-4 shrink-0"
                style={{
                  borderColor:
                    log.event.includes('signal') ? '#00b894' : log.event.includes('action') ? '#f0a500' : '#888',
                  color: log.event.includes('signal') ? '#00b894' : log.event.includes('action') ? '#f0a500' : '#888',
                }}
              >
                {log.event}
              </Badge>
              <span className="text-muted-foreground truncate">{log.node}</span>
              <span className="text-muted-foreground/50 ml-auto truncate">{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function fluctuateValue(current: string, signal: string): string {
  if (signal === 'node:active') {
    const num = parseInt(current.replace(/,/g, ''), 10);
    return (num + Math.floor(Math.random() * 20 - 5)).toLocaleString();
  }
  if (signal === 'signal:flux') {
    const v = parseFloat(current);
    return `${(v + (Math.random() - 0.4) * 0.3).toFixed(1)}K/s`;
  }
  if (signal === 'flush:latency') {
    const v = parseFloat(current);
    return `${Math.max(0.1, v + (Math.random() - 0.5) * 0.2).toFixed(1)}ms`;
  }
  if (signal === 'dirty:count') {
    const v = parseInt(current, 10);
    return String(Math.max(0, v + Math.floor(Math.random() * 6 - 3)));
  }
  return current;
}
