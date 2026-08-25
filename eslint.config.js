import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Full browser global set. The previous hand-rolled list of three
      // (document/window/console) failed on src/main.js itself, which uses
      // setTimeout/clearTimeout.
      globals: globals.browser,
    },
  },
]
