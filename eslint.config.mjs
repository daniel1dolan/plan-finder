import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
  { rules: { '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }] } },
  {
    // The engine and share codec must stay framework-free so they run under bun test as-is.
    files: ['src/engine/**', 'src/share/**', 'src/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'next', 'next/*', 'recharts'] }],
    },
  },
]);
