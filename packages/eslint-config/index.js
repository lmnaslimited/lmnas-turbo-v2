export default {
  root: true,
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['apps/*/src/components/**'],
      rules: {
        'no-restricted-syntax': ['error', { selector: 'Program', message: 'Reusable components are forbidden in apps/*/src/components. Move to packages/blocks.' }]
      }
    },
    {
      files: ['apps/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['**/services/**', '**/strapiClient/**', '**/lens/**', '**/rudder/**']
        }]
      }
    }
  ]
};
