module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**', 'coverage-integration/**'],
  },
  {
    files: ['**/*.{js,mjs}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['utils/logger.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
