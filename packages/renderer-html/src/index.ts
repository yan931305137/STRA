/**
 * @stra/renderer-html - HTML Renderer + Renderer Interface
 * 
 * Semantic tree → HTML projection
 * ❌ No logic, pure projection
 * 
 * BOUNDARY RULE:
 * - Must implement @stra/renderer-core RendererPlugin contract
 * - Cannot import @stra/ai-*, @stra/react, @stra/next
 * - Render function must be pure (deterministic, no mutation)
 */

// Re-export renderer-core contract
export type { RendererPlugin, RendererPluginMetadata } from '@stra/renderer-core';

// Renderer interface (shared types from @stra/types)
export type { Renderer, RendererProjection, RenderOutput, ProjectionDiff } from '@stra/types';

// HTML Renderer
export { HTMLRenderer, createHTMLRenderer } from './html';
