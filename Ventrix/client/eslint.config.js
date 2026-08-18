import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // React 17+ JSX transform makes the legacy React default import
      // unnecessary at runtime; keep the existing imports harmless while
      // components are migrated incrementally.
      "no-unused-vars": ["error", {
        varsIgnorePattern: "^React$",
        argsIgnorePattern: "^err$",
        caughtErrorsIgnorePattern: "^err$",
      }],
      // These data-loading effects intentionally set state after async I/O.
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },
])
