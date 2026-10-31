import { existsSync, readdirSync } from 'node:fs';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { featureBoundaryConfig } from './eslint-rules/feature-boundaries.js';
import noRoleComparison from './eslint-rules/no-role-comparison.js';

const featuresDir = 'src/features';
const features = existsSync(featuresDir)
  ? readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'src/lib/api/generated',
      'src/routeTree.gen.ts',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { local: { rules: { 'no-role-comparison': noRoleComparison } } },
    rules: { 'local/no-role-comparison': 'error' },
  },
  {
    files: ['*.config.{js,ts}', 'eslint-rules/**/*.js', 'scripts/**/*.{js,mjs}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  ...featureBoundaryConfig(features),
);
