/**
 * STRA Semantic Style System - Layout/tone/emphasis without className.
 * 
 * HARDENED:
 * - No className core dependency
 * - Style tokens are semantic (layout/tone/emphasis)
 * - Style does not pollute tree structure
 * - Deterministic style resolution
 */

import {
  SemanticStyleDefinition,
  SemanticRole,
  SemanticIntent,
  NodeId,
} from '@stra/types';

export interface ResolvedStyle {
  layout: string;
  tone: string;
  emphasis: string;
  spacing: string;
  size: string;
  custom: Record<string, string>;
}

/** Default style mappings by semantic role. */
const ROLE_LAYOUT_MAP: Record<string, string> = {
  page: 'vertical',
  header: 'horizontal',
  footer: 'horizontal',
  navigation: 'horizontal',
  main: 'vertical',
  section: 'vertical',
  article: 'vertical',
  sidebar: 'vertical',
  form: 'vertical',
  list: 'vertical',
  item: 'horizontal',
  container: 'vertical',
};

const INTENT_TONE_MAP: Record<string, string> = {
  display: 'neutral',
  action: 'primary',
  navigation: 'secondary',
  input: 'muted',
  submit: 'accent',
};

const ROLE_EMPHASIS_MAP: Record<string, string> = {
  page: 'high',
  header: 'high',
  footer: 'low',
  navigation: 'medium',
  main: 'high',
  button: 'high',
  field: 'medium',
  text: 'low',
  image: 'medium',
};

export class SemanticStyleSystem {
  /** Resolve computed styles for a node. */
  resolveStyle(
    role: SemanticRole,
    intent: SemanticIntent,
    explicitStyle: SemanticStyleDefinition,
  ): ResolvedStyle {
    return {
      layout: (explicitStyle.layout as string) ?? ROLE_LAYOUT_MAP[role] ?? 'vertical',
      tone: (explicitStyle.tone as string) ?? INTENT_TONE_MAP[intent] ?? 'neutral',
      emphasis: (explicitStyle.emphasis as string) ?? ROLE_EMPHASIS_MAP[role] ?? 'medium',
      spacing: (explicitStyle.spacing as string) ?? 'standard',
      size: (explicitStyle.custom?.size as string) ?? 'medium',
      custom: this.extractCustomStyles(explicitStyle),
    };
  }

  /** Convert resolved style to CSS properties. */
  toCSSProperties(style: ResolvedStyle): Record<string, string> {
    const css: Record<string, string> = {};

    // Layout
    switch (style.layout) {
      case 'vertical':
        css.display = 'flex';
        css.flexDirection = 'column';
        break;
      case 'horizontal':
        css.display = 'flex';
        css.flexDirection = 'row';
        break;
      case 'grid':
        css.display = 'grid';
        break;
      case 'inline':
        css.display = 'inline';
        break;
    }

    // Tone
    switch (style.tone) {
      case 'primary':
        css.color = '#1a1a2e';
        css.backgroundColor = '#f0f0f0';
        break;
      case 'accent':
        css.color = '#ffffff';
        css.backgroundColor = '#f0a500';
        break;
      case 'muted':
        css.color = '#6b7280';
        break;
      case 'secondary':
        css.color = '#4b5563';
        break;
      default:
        css.color = '#1a1a2e';
    }

    // Emphasis
    switch (style.emphasis) {
      case 'high':
        css.fontWeight = '700';
        break;
      case 'medium':
        css.fontWeight = '500';
        break;
      case 'low':
        css.fontWeight = '400';
        break;
    }

    // Spacing
    switch (style.spacing) {
      case 'compact':
        css.gap = '4px';
        css.padding = '4px';
        break;
      case 'standard':
        css.gap = '8px';
        css.padding = '8px';
        break;
      case 'spacious':
        css.gap = '16px';
        css.padding = '16px';
        break;
    }

    // Custom overrides
    for (const [key, value] of Object.entries(style.custom)) {
      css[key] = value;
    }

    return css;
  }

  private extractCustomStyles(style: SemanticStyleDefinition): Record<string, string> {
    const reserved = new Set(['layout', 'tone', 'emphasis', 'spacing', 'size']);
    const custom: Record<string, string> = {};
    for (const [key, value] of Object.entries(style)) {
      if (!reserved.has(key)) {
        custom[key] = String(value);
      }
    }
    return custom;
  }
}

/** Create a new SemanticStyleSystem. */
export function createSemanticStyleSystem(): SemanticStyleSystem {
  return new SemanticStyleSystem();
}
