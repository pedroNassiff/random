import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Gate de Track 2 acotado a la feature Fútbol Vaquero (el JSX legacy no se lintea aún).
export default tseslint.config(
  {
    files: ['src/vaca-futbolera/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      complexity: ['error', 10],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
)
