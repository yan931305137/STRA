import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  globalIgnores([
    'node_modules/**',
    'dist/**',
    '_archive/**',
    'apps/**',
    'scripts/**/*.js',
    'pnpm-lock.yaml',
  ]),
]);

export default eslintConfig;
