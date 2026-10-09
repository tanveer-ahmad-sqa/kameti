// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Deno edge functions are linted/type-checked by `deno` (Phase 3+). _shared is plain TS
    // used by the app as well, so it stays linted here.
    ignores: [
      'dist/*',
      '.expo/*',
      'supabase/functions/*',
      '!supabase/functions/_shared',
      'src/types/database.types.ts',
    ],
  },
]);
