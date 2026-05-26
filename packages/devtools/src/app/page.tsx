'use client';

import { useState } from 'react';

export default function DevToolsPage() {
  const [activeTab, setActiveTab] = useState<'tree' | 'signals' | 'actions'>('tree');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold">STRA DevTools</h1>
        <p className="text-gray-400 text-sm mt-1">Semantic Tree Runtime + AI Inspector</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(['tree', 'signals', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'tree' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-4">Semantic Tree</h3>
              <div className="font-mono text-sm space-y-1 text-gray-300">
                <div className="text-blue-400">root</div>
                <div className="ml-4 text-green-400">├── header</div>
                <div className="ml-8 text-yellow-400">│   ├── title</div>
                <div className="ml-8 text-yellow-400">│   └── navigation</div>
                <div className="ml-4 text-green-400">├── main</div>
                <div className="ml-8 text-yellow-400">│   ├── content</div>
                <div className="ml-8 text-yellow-400">│   └── sidebar</div>
                <div className="ml-4 text-green-400">└── footer</div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'signals' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">Signal Inspector</h3>
            <div className="space-y-3">
              {[
                { name: 'count', value: '42', deps: 3 },
                { name: 'isActive', value: 'true', deps: 1 },
                { name: 'userName', value: '"STRA User"', deps: 2 },
              ].map((signal) => (
                <div key={signal.name} className="flex items-center justify-between bg-gray-950 rounded-lg p-3">
                  <span className="font-mono text-blue-400">{signal.name}</span>
                  <span className="font-mono text-green-400">{signal.value}</span>
                  <span className="text-gray-500 text-sm">{signal.deps} deps</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'actions' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">Action Log</h3>
            <div className="space-y-2">
              {[
                { action: 'increment', target: 'count', time: '12:00:01' },
                { action: 'toggle', target: 'isActive', time: '12:00:03' },
                { action: 'update', target: 'userName', time: '12:00:05' },
              ].map((entry, i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-950 rounded-lg p-3 text-sm">
                  <span className="text-gray-500">{entry.time}</span>
                  <span className="text-purple-400 font-mono">{entry.action}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-400 font-mono">{entry.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
