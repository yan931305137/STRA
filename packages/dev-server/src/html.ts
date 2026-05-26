/**
 * @stra/dev-server - HTML injection
 *
 * Injects HMR client script and modulepreload links into HTML.
 */

/** Inject the HMR client script into an HTML document. */
export function injectHMRClient(html: string, hmrPath: string = '/__stra_hmr'): string {
  const hmrScript = [
    '<script type="module">',
    `// STRA HMR Client (injected by @stra/dev-server)`,
    `import { createHMRRuntime } from '/@stra/client';`,
    `const __stra_hmr__ = createHMRRuntime({ wsUrl: '${getWSUrl(hmrPath)}' });`,
    `__stra_hmr__.connect();`,
    `window.__STRA_HMR__ = __stra_hmr__;`,
    '</script>',
  ].join('\n');

  // Insert before </head> or at end
  if (html.includes('</head>')) {
    return html.replace('</head>', `${hmrScript}\n</head>`);
  }
  return `${hmrScript}\n${html}`;
}

/** Inject an ES module script entry point. */
export function injectEntryScript(html: string, entryPath: string): string {
  const script = `<script type="module" src="${entryPath}"></script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}\n</body>`);
  }
  return `${html}\n${script}`;
}

/** Rewrite script src attributes to go through the dev server transform pipeline. */
export function rewriteScriptSources(html: string): string {
  // Rewrite <script src="..."> to go through /@stra/transform
  return html.replace(
    /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g,
    (match: string, before: string, src: string, after: string) => {
      // Skip already-processed URLs and external URLs
      if (src.startsWith('/@stra/') || src.startsWith('http://') || src.startsWith('https://')) {
        return match;
      }
      const typeAttr = before.includes('type="module"') || after.includes('type="module"')
        ? ''
        : '';
      return `<script ${before}src="/@stra/transform${src}"${after}>`;
    },
  );
}

/** Get WebSocket URL from HMR path. */
function getWSUrl(hmrPath: string): string {
  // This will be resolved at runtime based on location
  return hmrPath;
}
