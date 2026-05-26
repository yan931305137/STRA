/**
 * AI Copilot Showcase - 展示 STRA 驱动的 AI 聊天界面
 *
 * 用 STRA signal 管理：
 * - 对话消息列表
 * - AI 思考状态
 * - 用户输入状态
 * - 推荐操作
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================================
// Demo Data
// ============================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: string[];
}

const DEMO_CONVERSATION: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: '帮我分析一下这个季度的用户增长趋势',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: '根据语义树数据分析，本季度用户增长呈现以下特征：\n\n1. **总增长 23.5%**，超出预期目标 5 个百分点\n2. 核心驱动力来自移动端新用户（占比 68%）\n3. 第 8 周出现增长拐点，与营销活动启动时间吻合\n\n我已识别到 3 个可操作的信号节点，是否需要深入查看？',
    timestamp: Date.now() - 30000,
    actions: ['查看信号节点', '生成报告', '调整预测模型'],
  },
  {
    id: 'msg-3',
    role: 'user',
    content: '查看信号节点',
    timestamp: Date.now() - 10000,
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: '已定位到以下关键信号节点：\n\n• `node:dashboard:metric-users` — 用户总量信号（当前值: 12,847）\n• `node:dashboard:metric-growth` — 增长率信号（当前值: 23.5%）\n• `node:dashboard:metric-retention` — 留存率信号（当前值: 89.2%）\n\n这些信号通过 STRA 依赖图自动关联，任何指标变化都会触发下游更新。',
    timestamp: Date.now(),
    actions: ['调整指标权重', '导出数据', '设置告警'],
  },
];

const QUICK_ACTIONS = [
  { icon: '📊', label: '数据分析' },
  { icon: '🔍', label: '语义查询' },
  { icon: '⚡', label: '信号追踪' },
  { icon: '📝', label: '生成报告' },
];

// ============================================================
// Inner Component (inside STRProvider)
// ============================================================

function CopilotInner() {
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_CONVERSATION);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // ScrollArea viewport ref for auto-scroll
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);

    // 模拟 AI 响应
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '已收到您的请求。STRA 运行时正在处理语义信号...\n\n通过 Action 派发路径：`user-action → signal:update → renderer:flush`，当前语义树状态保持一致性。',
        timestamp: Date.now(),
        actions: ['继续深入', '查看树结构', '导出结果'],
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsThinking(false);
    }, 1200);
  }, [inputValue]);

  const handleActionClick = useCallback((action: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: action,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `正在执行 "${action}"...\n\nSTR Action 已派发，信号依赖图自动传播变更。所有相关节点已标记为 dirty 并将在下一个 flush 周期中更新。`,
        timestamp: Date.now(),
        actions: ['确认', '撤销操作', '查看详情'],
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsThinking(false);
    }, 800);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0a500]/20">
        <div className="w-8 h-8 rounded-lg bg-[#f0a500]/20 flex items-center justify-center overflow-hidden">
          <img src="/stra-icon.svg" alt="STRA" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-[#f0a500]">STRA Copilot</h3>
          <p className="text-[10px] text-muted-foreground">Signal-driven AI Interface</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px] border-[#f0a500]/30 text-[#f0a500]">
          Active
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 py-3">
        <ScrollArea className="h-full">
          <div ref={viewportRef} className="space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#f0a500]/15 text-[#f0a500]/90 border border-[#f0a500]/20'
                      : msg.role === 'system'
                        ? 'bg-muted text-muted-foreground border border-border'
                        : 'bg-card text-card-foreground border border-border'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.actions.map(action => (
                        <button
                          key={action}
                          onClick={() => handleActionClick(action)}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-[#f0a500]/30 text-[#f0a500]/80 hover:bg-[#f0a500]/10 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f0a500] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f0a500] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f0a500] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-border/50">
        <div className="flex gap-2 mb-2">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.label}
              onClick={() => handleActionClick(action.label)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-border hover:border-[#f0a500]/30 hover:bg-[#f0a500]/5 transition-colors text-muted-foreground hover:text-[#f0a500]/80"
            >
              <span>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="向 STRA Copilot 提问..."
            className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#f0a500]/50 focus:ring-1 focus:ring-[#f0a500]/20"
          />
          <Button
            onClick={handleSend}
            size="sm"
            className="bg-[#f0a500] text-black hover:bg-[#f0a500]/80"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Exported Component
// ============================================================

export function CopilotDemo() {
  return <CopilotInner />;
}
