/**
 * STRA Semantic Type System - Intent/role/schema typing.
 * 
 * HARDENED:
 * - Not over-TS-magic
 * - Node semantic types are stable
 * - Type checking is runtime-aware
 * - Deterministic validation
 */

import {
  NodeType,
  SemanticRole,
  SemanticIntent,
  SemanticSchema,
  NodeId,
} from '@stra/types';

export interface TypeConstraint {
  role: SemanticRole;
  intent: SemanticIntent;
  requiredSchemaFields: string[];
  optionalSchemaFields: string[];
  allowedChildRoles: SemanticRole[];
  maxChildren: number;
}

/** Built-in type constraints for common node types. */
const BUILTIN_CONSTRAINTS: Partial<Record<NodeType, TypeConstraint>> = {
  Page: {
    role: 'page',
    intent: 'display',
    requiredSchemaFields: [],
    optionalSchemaFields: ['title'],
    allowedChildRoles: ['header', 'main', 'footer', 'sidebar'],
    maxChildren: Infinity,
  },
  Header: {
    role: 'header',
    intent: 'display',
    requiredSchemaFields: [],
    optionalSchemaFields: ['title'],
    allowedChildRoles: ['nav', 'field', 'text', 'image'],
    maxChildren: Infinity,
  },
  Footer: {
    role: 'footer',
    intent: 'display',
    requiredSchemaFields: [],
    optionalSchemaFields: ['text'],
    allowedChildRoles: ['text', 'link', 'nav'],
    maxChildren: Infinity,
  },
  Navigation: {
    role: 'nav',
    intent: 'navigation',
    requiredSchemaFields: [],
    optionalSchemaFields: ['label'],
    allowedChildRoles: ['link', 'text', 'button'],
    maxChildren: Infinity,
  },
  Form: {
    role: 'form',
    intent: 'input',
    requiredSchemaFields: [],
    optionalSchemaFields: ['action', 'method'],
    allowedChildRoles: ['field', 'button'],
    maxChildren: Infinity,
  },
  Button: {
    role: 'button',
    intent: 'action',
    requiredSchemaFields: [],
    optionalSchemaFields: ['label', 'action'],
    allowedChildRoles: ['text', 'image'],
    maxChildren: 1,
  },
  TextField: {
    role: 'field',
    intent: 'input',
    requiredSchemaFields: [],
    optionalSchemaFields: ['name', 'placeholder', 'type', 'value'],
    allowedChildRoles: [],
    maxChildren: 0,
  },
  List: {
    role: 'list',
    intent: 'display',
    requiredSchemaFields: [],
    optionalSchemaFields: [],
    allowedChildRoles: ['item'],
    maxChildren: Infinity,
  },
  ProductCard: {
    role: 'item',
    intent: 'display',
    requiredSchemaFields: [],
    optionalSchemaFields: ['name', 'price', 'image'],
    allowedChildRoles: ['text', 'image', 'button'],
    maxChildren: Infinity,
  },
};

export interface TypeValidationResult {
  valid: boolean;
  errors: string[];
}

export class SemanticTypeSystem {
  /** Get type constraint for a node type. */
  getConstraint(nodeType: NodeType): TypeConstraint | undefined {
    return BUILTIN_CONSTRAINTS[nodeType];
  }

  /** Validate a node against its type constraints. */
  validate(nodeType: NodeType, role: SemanticRole, intent: SemanticIntent, schema: SemanticSchema): TypeValidationResult {
    const errors: string[] = [];
    const constraint = BUILTIN_CONSTRAINTS[nodeType];

    if (!constraint) {
      // Unknown type - allow but warn
      return { valid: true, errors: [] };
    }

    // Check role
    if (role !== constraint.role) {
      errors.push(`Type "${nodeType}" expects role "${constraint.role}" but got "${role}".`);
    }

    // Check intent
    if (intent !== constraint.intent) {
      errors.push(`Type "${nodeType}" expects intent "${constraint.intent}" but got "${intent}".`);
    }

    // Check required schema fields
    for (const field of constraint.requiredSchemaFields) {
      if (!(field in schema)) {
        errors.push(`Type "${nodeType}" requires schema field "${field}".`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Check if a child role is allowed under a parent type. */
  isChildAllowed(parentType: NodeType, childRole: SemanticRole): boolean {
    const constraint = BUILTIN_CONSTRAINTS[parentType];
    if (!constraint) return true; // No constraint = allow
    return constraint.allowedChildRoles.includes(childRole);
  }

  /** Register a custom type constraint. */
  registerConstraint(nodeType: NodeType, constraint: TypeConstraint): void {
    (BUILTIN_CONSTRAINTS as Record<string, TypeConstraint>)[nodeType] = constraint;
  }

  /** Get all registered type names. */
  getRegisteredTypes(): NodeType[] {
    return Object.keys(BUILTIN_CONSTRAINTS).sort();
  }
}

/** Create a new SemanticTypeSystem. */
export function createSemanticTypeSystem(): SemanticTypeSystem {
  return new SemanticTypeSystem();
}
