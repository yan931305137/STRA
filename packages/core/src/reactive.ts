/**
 * @stra/core - Reactive Tree API
 *
 * High-level convenience API for STRA:
 *   createTree({ count: 0 })  → reactive proxy object
 *   action(() => { tree.count++ })  → state mutation function
 *
 * Design:
 *   - Proxy-based reactivity: tree property access returns SignalRef
 *   - SignalRef tracks which property was accessed
 *   - useSignal(tree.prop) in React subscribes and unwraps
 *   - Tree = SSOT, Action = sole write entry, Signal = sole response system
 */

// ============================================================
// SignalRef - Reactive reference to a tree property
// ============================================================

/** Marker symbol for SignalRef detection */
const SIGNAL_REF_SYMBOL = Symbol.for('stra.signal-ref');

/** Reactive reference to a tree property path */
export class SignalRef<T = unknown> {
  /** Marker for instanceof / duck-type checks */
  readonly [SIGNAL_REF_SYMBOL] = true as const;

  constructor(
    /** Property path on the tree (e.g. 'count', 'user.name') */
    public readonly path: string,
    /** Back-reference to the tree proxy (for subscription) */
    public readonly tree: object,
    /** Read the current value from raw data */
    private readonly _getValue: () => T,
  ) {}

  /** Current value (always reads from live data) */
  get value(): T {
    return this._getValue();
  }

  /** Coerce to primitive for arithmetic / comparison */
  valueOf(): T {
    return this._getValue();
  }

  /** Coerce to string for template literals / interpolation */
  toString(): string {
    return String(this._getValue());
  }

  /** Symbol.toPrimitive for `+`, `${}`, comparison operators */
  [Symbol.toPrimitive](hint: 'string' | 'number' | 'default'): T | string {
    const v = this._getValue();
    return hint === 'string' ? String(v) : v;
  }
}

/** Type guard: is this a SignalRef? */
export function isSignalRef(value: unknown): value is SignalRef {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as any)[SIGNAL_REF_SYMBOL] === true
  );
}

// ============================================================
// Tree Internal Metadata
// ============================================================

export interface TreeMeta {
  /** Raw data store (the actual values) */
  data: Record<string, unknown>;
  /** Per-path subscribers: path → Set of callbacks */
  subscribers: Map<string, Set<() => void>>;
  /** Cached SignalRefs: path → SignalRef (stable identity) */
  refs: Map<string, SignalRef>;
  /** The proxy itself (for ref back-reference) */
  proxy: object;
}

const TREE_META_SYMBOL = Symbol.for('stra.tree-meta');

/** Get internal metadata from a reactive tree */
export function getTreeMeta(tree: object): TreeMeta | undefined {
  return (tree as any)[TREE_META_SYMBOL] as TreeMeta | undefined;
}

// ============================================================
// createTree - Create a reactive tree from a plain object
// ============================================================

/**
 * Create a reactive tree from a plain object.
 *
 * @example
 * const tree = createTree({ count: 0, name: 'hello' })
 * tree.count  → SignalRef (trackable)
 * tree.count++  → triggers subscriber notifications
 */
export function createTree<T extends Record<string, unknown>>(initial: T): T {
  const data: Record<string, unknown> = { ...initial };
  const subscribers = new Map<string, Set<() => void>>();
  const refs = new Map<string, SignalRef>();

  /** Notify all subscribers for a given path */
  const notify = (path: string): void => {
    const subs = subscribers.get(path);
    if (subs) {
      for (const cb of subs) cb();
    }
  };

  const meta: TreeMeta = {
    data,
    subscribers,
    refs,
    proxy: null as any, // set below
  };

  const proxy = new Proxy(data, {
    get(target, prop, receiver) {
      // Internal: access metadata
      if (prop === TREE_META_SYMBOL) return meta;
      // Internal: subscribe to a path
      if (prop === '__stra_subscribe') {
        return (path: string, callback: () => void): (() => void) => {
          if (!subscribers.has(path)) {
            subscribers.set(path, new Set());
          }
          subscribers.get(path)!.add(callback);
          return () => {
            subscribers.get(path)?.delete(callback);
          };
        };
      }
      // Internal: access raw data object
      if (prop === '__stra_raw') return data;

      // Symbol properties pass through
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);

      const path = String(prop);

      // Return cached SignalRef for stable identity
      if (!refs.has(path)) {
        refs.set(
          path,
          new SignalRef(path, proxy, () => {
            const val = (target as Record<string, unknown>)[path];
            // Nested object: return a nested proxy for deep reactivity
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
              return createNestedProxy(val as Record<string, unknown>, path, subscribers);
            }
            return val;
          }),
        );
      }
      return refs.get(path);
    },

    set(target, prop, value, receiver) {
      if (typeof prop === 'symbol') return Reflect.set(target, prop, value, receiver);

      const path = String(prop);

      // If value is a SignalRef, unwrap it
      if (isSignalRef(value)) {
        value = value.value;
      }

      const result = Reflect.set(target, prop, value, receiver);
      notify(path);
      return result;
    },
  });

  meta.proxy = proxy;
  return proxy as T;
}

// ============================================================
// Nested Proxy - Deep reactivity for nested objects
// ============================================================

/** Create a nested reactive proxy for a sub-object */
function createNestedProxy(
  obj: Record<string, unknown>,
  parentPath: string,
  subscribers: Map<string, Set<() => void>>,
): object {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      const fullPath = `${parentPath}.${String(prop)}`;
      const value = Reflect.get(target, prop, receiver);

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return createNestedProxy(value as Record<string, unknown>, fullPath, subscribers);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'symbol') return Reflect.set(target, prop, value, receiver);
      const fullPath = `${parentPath}.${String(prop)}`;
      const result = Reflect.set(target, prop, value, receiver);
      // Notify both the specific path and the parent
      const subs = subscribers.get(fullPath);
      if (subs) {
        for (const cb of subs) cb();
      }
      const parentSubs = subscribers.get(parentPath);
      if (parentSubs) {
        for (const cb of parentSubs) cb();
      }
      return result;
    },
  });
}

// ============================================================
// subscribeTree - Subscribe to changes on a tree path
// ============================================================

/** Subscribe to property changes on a reactive tree */
export function subscribeTree(
  tree: object,
  path: string,
  callback: () => void,
): () => void {
  const meta = getTreeMeta(tree);
  if (!meta) {
    throw new Error('[STRA] subscribeTree: argument is not a reactive tree');
  }
  if (!meta.subscribers.has(path)) {
    meta.subscribers.set(path, new Set());
  }
  meta.subscribers.get(path)!.add(callback);
  return () => {
    meta.subscribers.get(path)?.delete(callback);
  };
}

// ============================================================
// action - Create a state mutation function
// ============================================================

/**
 * Create an action function. Actions are the **sole write entry** to the tree.
 *
 * @example
 * const inc = action(() => { tree.count++ })
 * inc()  → mutates tree.count, triggers subscriber notifications
 */
export function action<T extends (...args: any[]) => any>(fn: T): T {
  const wrapped = (...args: Parameters<T>): ReturnType<T> => {
    return fn(...args);
  };
  return wrapped as T;
}
