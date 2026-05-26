export default function DocsPage() {
  const packages = [
    { layer: 'Core', items: ['@stra/core', '@stra/types'] },
    { layer: 'Adapters', items: ['@stra/react', '@stra/next', '@stra/react-devtools'] },
    { layer: 'AI', items: ['@stra/ai-sdk', '@stra/compiler-ai', '@stra/ai-layout', '@stra/ai-action'] },
    { layer: 'DevTools', items: ['@stra/devtools', '@stra/time-travel', '@stra/explain', '@stra/inspect'] },
    { layer: 'Diff / Graph', items: ['@stra/diff', '@stra/graph', '@stra/causality'] },
    { layer: 'DSL / Compiler', items: ['@stra/dsl', '@stra/compiler', '@stra/fs'] },
    { layer: 'Renderer', items: ['@stra/renderer-html', '@stra/renderer-console', '@stra/ssr', '@stra/dom'] },
    { layer: 'Production', items: ['@stra/persistence', '@stra/seo', '@stra/a11y', '@stra/analytics'] },
    { layer: 'AI Application', items: ['@stra/copilot', '@stra/nl-builder', '@stra/agent', '@stra/prompt-runtime'] },
    { layer: 'Ecosystem', items: ['@stra/cli', '@stra/create-app', '@stra/vscode', '@stra/storybook', '@stra/figma'] },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <img src="/stra-logo.svg" alt="STRA" className="h-8" />
          <h1 className="text-2xl font-mono font-bold text-[#10b981]">Documentation</h1>
        </div>
        <p className="text-sm text-gray-400 mb-8">
          Semantic Tree Runtime + AI - AI-readable semantic frontend layer
        </p>

        <div className="space-y-6">
          {packages.map((group) => (
            <div key={group.layer}>
              <h2 className="text-sm font-mono font-semibold text-[#8b5cf6] mb-3 uppercase tracking-wider">
                {group.layer}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((pkg) => (
                  <div
                    key={pkg}
                    className="bg-[#111] border border-[#222] rounded px-3 py-2 font-mono text-xs text-[#10b981]"
                  >
                    {pkg}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
