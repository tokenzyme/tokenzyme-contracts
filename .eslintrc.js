module.exports = {
  env: {
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:deprecation/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: ['lib', 'typechain', '.eslintrc.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    '@typescript-eslint/class-methods-use-this': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { arguments: false, attributes: false, properties: false } },
    ],
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/restrict-template-expressions': 'off',
    'class-methods-use-this': 'off',
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        alphabetize: { caseInsensitive: false, order: 'asc' },
        'newlines-between': 'always',
      },
    ],
    'import/prefer-default-export': 'off',
    'no-empty-function': 'off',
    'sort-imports': ['error', { ignoreDeclarationSort: true }],
  },
  settings: {
    'import/resolver': { node: true, typescript: true },
  },
};
