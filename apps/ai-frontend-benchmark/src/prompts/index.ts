/**
 * Framework-specific Prompt Templates
 *
 * Each framework gets the SAME task description but wrapped in a
 * framework-specific system prompt that guides the AI to use that
 * framework's idioms correctly.
 */
import type { Framework, PromptTemplate, BenchmarkTask } from '../types/index.js';

// ─── Shared task description formatter ───
function formatTaskDescription(task: BenchmarkTask): string {
  return `
## Task: ${task.title}

${task.description}

### Requirements:
${task.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### Acceptance Criteria:
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Output:
- Produce a SINGLE self-contained HTML file
- Include all CSS inline in a <style> tag
- Include all JavaScript inline in a <script> tag
- The file must be directly openable in a browser
- Do NOT use any build tools, bundlers, or npm packages
- Do NOT reference external files or CDN URLs except for CSS frameworks (Tailwind CDN is OK)
`.trim();
}

// ─── React Prompt ───
const reactSystemPrompt = `You are an expert React developer. You write clean, idiomatic React code.

RULES:
- Use React with JSX (via Babel standalone CDN for browser execution)
- Use React hooks (useState, useEffect, useCallback, etc.)
- Follow React best practices for state management
- Use Tailwind CSS (via CDN) for styling
- Write all code in a single HTML file
- Include React, ReactDOM, and Babel standalone via CDN
- Component names must be PascalCase
- Use functional components only (no class components)
- Manage form state with useState
- Validate forms with custom validation logic
- Simulate API calls with setTimeout/Promise`;

// ─── Vue Prompt ───
const vueSystemPrompt = `You are an expert Vue.js developer. You write clean, idiomatic Vue code.

RULES:
- Use Vue 3 with Composition API
- Use Vue via CDN (vue.global.prod.js)
- Use Tailwind CSS (via CDN) for styling
- Write all code in a single HTML file
- Use <template> inside the Vue app mount point
- Use ref/reactive for state management
- Use computed properties for derived state
- Validate forms with custom validation logic
- Simulate API calls with setTimeout/Promise
- Follow Vue 3 best practices`;

// ─── STRA Prompt ───
const strSystemPrompt = `You are an expert STRA (Semantic Tree Runtime + AI) developer. You write clean, idiomatic STRA code.

STRA CORE CONCEPTS:
- Tree = Single Source of Truth (SSOT) — the semantic tree IS the state
- Action = Only write path — ALL state changes must go through dispatchAction()
- Signal = Only reactive system — UI derives from Signal subscriptions
- Renderer = Pure function of tree — no side effects in rendering

You MUST include this minimal STRA runtime inline in your HTML (inside a <script> tag, BEFORE your app code):

\`\`\`javascript
// === MINIMAL STRA RUNTIME (include this verbatim) ===
const STRA = (function() {
  const signals = new Map();
  const listeners = new Map();

  function createTree(schema) {
    const tree = { nodes: {}, root: schema.id };
    function addNode(node, parentId) {
      tree.nodes[node.id] = { ...node, children: node.children?.map(c => c.id) || [] };
      if (parentId) tree.nodes[parentId].children.push(node.id);
      node.children?.forEach(c => addNode(c, node.id));
    }
    addNode(schema, null);
    return tree;
  }

  function dispatchAction(tree, action) {
    const node = tree.nodes[action.targetId];
    if (!node) return;
    if (action.type === 'SET_VALUE') {
      node.props = { ...node.props, ...action.payload };
    } else if (action.type === 'SET_PROP') {
      node.props = { ...node.props, [action.payload.key]: action.payload.value };
    }
    const key = action.targetId + '.' + action.type;
    const cbs = listeners.get(key) || [];
    cbs.forEach(cb => cb({ type: action.type, targetId: action.targetId, payload: action.payload }));
    const allCbs = listeners.get('*') || [];
    allCbs.forEach(cb => cb({ type: action.type, targetId: action.targetId, payload: action.payload }));
  }

  function subscribeSignal(tree, nodeId, callback, actionType = '*') {
    const key = actionType === '*' ? '*' : nodeId + '.' + actionType;
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(callback);
  }

  function getSnapshot(tree) {
    return { nodes: JSON.parse(JSON.stringify(tree.nodes)), root: tree.root };
  }

  return { createTree, dispatchAction, subscribeSignal, getSnapshot };
})();
// === END STRA RUNTIME ===
\`\`\`

After including the runtime, build your app using ONLY these 4 APIs:
1. createTree(schema) — create the semantic tree
2. dispatchAction(tree, action) — change state (ONLY way)
3. subscribeSignal(tree, nodeId, callback, actionType?) — react to changes
4. getSnapshot(tree) — read state (ONLY way)

Then implement a render() function that:
- Calls getSnapshot(tree) to read state
- Uses innerHTML with template literals to build the DOM (concise & compact)
- Is called after every dispatchAction() via subscribeSignal()

IMPORTANT: In the render() function, use innerHTML with template literals (backtick strings) to construct HTML.
DO NOT use document.createElement() — it produces extremely verbose code that wastes tokens.
Example: app.innerHTML = \`<div class="p-4"><h1>\${title}</h1></div>\` instead of creating elements one by one.

EXAMPLE APP STRUCTURE:
\`\`\`javascript
// 1. Create tree
const tree = STRA.createTree({
  id: 'app',
  type: 'container',
  props: { activeTab: 'login' },
  children: [
    { id: 'tab-login', type: 'form', props: { title: 'Login' } },
    { id: 'tab-register', type: 'form', props: { title: 'Register' } }
  ]
});

// 2. Subscribe to changes → re-render
STRA.subscribeSignal(tree, '*', () => render());

// 3. Render (pure function of tree) — use innerHTML for conciseness
function render() {
  const snap = STRA.getSnapshot(tree);
  const app = document.getElementById('app');
  const activeTab = snap.nodes['app'].props.activeTab;
  // Use template literals to build HTML compactly
  let html = '<div class="p-4">';
  html += activeTab === 'login' ? '<form onsubmit="handleLogin(event)">...</form>' : '<form onsubmit="handleRegister(event)">...</form>';
  html += '</div>';
  app.innerHTML = html;
}

// 4. Dispatch actions on user interaction
function handleLogin(e) {
  e.preventDefault();
  STRA.dispatchAction(tree, { type: 'SET_VALUE', targetId: 'app', payload: { activeTab: 'register' } });
  // No need to call render() — subscribeSignal handles it
}

// Initial render
render();
\`\`\`

RULES:
- ALL state lives in the STRA tree — NO React useState / Vue ref for app state
- ALL mutations go through dispatchAction() — NEVER mutate tree directly
- ALL reads go through getSnapshot() — NEVER read tree.nodes directly
- Renderer is a PURE FUNCTION — takes snapshot, updates DOM
- Use innerHTML with template literals in render() — NEVER use document.createElement() (too verbose, wastes tokens)
- Use inline event handlers (onclick="...") in innerHTML — avoids manual addEventListener
- Use Tailwind CSS (via CDN) for styling
- Write all code in a single HTML file
- Include the minimal STRA runtime verbatim from above
- Simulate API calls with setTimeout/Promise
- Form values MUST be stored in tree node props via dispatchAction SET_VALUE
- Validation errors MUST be stored in tree node props via dispatchAction SET_VALUE`;

const systemPrompts: Record<Framework, string> = {
  react: reactSystemPrompt,
  vue: vueSystemPrompt,
  str: strSystemPrompt,
};

export function createPromptTemplate(framework: Framework, task: BenchmarkTask): PromptTemplate {
  return {
    framework,
    taskId: task.id,
    systemPrompt: systemPrompts[framework],
    userPrompt: formatTaskDescription(task),
    editPrompt: task.editPrompt,
  };
}

export function createAllPromptTemplates(task: BenchmarkTask): PromptTemplate[] {
  return (['react', 'vue', 'stra'] as Framework[]).map((fw) =>
    createPromptTemplate(fw, task)
  );
}
