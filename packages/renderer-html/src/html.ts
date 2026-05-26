/**
 * STRA HTML Renderer - Renders semantic tree as HTML.
 * 
 * HARDENED:
 * - Pure projection: never mutates runtime state
 * - HTML is just output, not the source of truth
 * - Deterministic output
 * - Implements @stra/renderer-core RendererPlugin contract
 */

import { NodeId, DirtyRecord, Renderer, RendererProjection } from '@stra/types';
import type { RendererPlugin, RendererPluginMetadata } from '@stra/renderer-core';
import { TreeNode } from '@stra/core';

export class HTMLRenderer implements Renderer, RendererPlugin {
  readonly name = 'STR_HTMLRenderer';

  private readonly projections: Map<NodeId, RendererProjection> = new Map();

  render(root: object): string {
    return this.renderNode(root as TreeNode);
  }

  onNodeUpdate(nodeId: NodeId, record: DirtyRecord): void {
    void record;
    this.invalidate(nodeId);
  }

  getProjection(nodeId: NodeId): RendererProjection | undefined {
    return this.projections.get(nodeId);
  }

  invalidate(nodeId: NodeId): void {
    this.projections.delete(nodeId);
  }

  invalidateAll(): void {
    this.projections.clear();
  }

  private renderNode(node: TreeNode): string {
    const tag = this.semanticToTag(node.role);
    const attrs = this.buildAttributes(node);
    const schemaContent = this.renderSchemaContent(node);
    const childrenHTML = node.children
      .map((child: TreeNode) => this.renderNode(child))
      .join('');

    return `<${tag}${attrs}>${schemaContent}${childrenHTML}</${tag}>`;
  }

  private semanticToTag(role: string): string {
    const roleMap: Record<string, string> = {
      page: 'div',
      header: 'header',
      footer: 'footer',
      nav: 'nav',
      navigation: 'nav',
      main: 'main',
      section: 'section',
      article: 'article',
      sidebar: 'aside',
      form: 'form',
      field: 'input',
      button: 'button',
      link: 'a',
      text: 'span',
      image: 'img',
      media: 'div',
      list: 'ul',
      item: 'li',
      overlay: 'div',
      slot: 'div',
      container: 'div',
      custom: 'div',
    };
    return roleMap[role] ?? 'div';
  }

  private buildAttributes(node: TreeNode): string {
    const parts: string[] = [
      `data-node-id="${node.id}"`,
      `data-type="${node.type}"`,
      `data-role="${node.role}"`,
      `data-intent="${node.intent}"`,
      `data-phase="${node.phase}"`,
    ];

    // Add schema fields as data attributes
    for (const [key, value] of Object.entries(node.schema)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        parts.push(`data-${key}="${String(value)}"`);
      }
    }

    return ' ' + parts.join(' ');
  }

  private renderSchemaContent(node: TreeNode): string {
    const parts: string[] = [];

    if (node.schema.label) {
      parts.push(String(node.schema.label));
    }
    if (node.schema.text) {
      parts.push(String(node.schema.text));
    }

    return parts.join('');
  }
}

/** Create an HTML renderer. */
export function createHTMLRenderer(): HTMLRenderer {
  return new HTMLRenderer();
}
