/**
 * @stra/resolver - Path resolution for STRA toolchain
 *
 * Resolves import specifiers to absolute paths with support for:
 * - Path aliases (@/ → ./src/)
 * - node_modules resolution with package.json main/module
 * - Extension resolution (.ts, .tsx, .js, .jsx, etc.)
 * - Plugin resolve hooks
 */

export {
  Resolver,
  createResolver,
} from './resolver';

export type {
  ResolverOptions,
  ResolvedModule,
} from './types';
