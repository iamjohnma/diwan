/** @type {import('prettier').Config} */
const config = {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: 'lf',
  importOrder: [
    '^react$',
    '^react-dom(?:/.*)?$',
    '<THIRD_PARTY_MODULES>',
    '^@lcms(?:/.*)?$',
    '^(?:@/(?:.*)|\\.\\.?/.*)$'
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
  jsxSingleQuote: false,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  printWidth: 80,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none'
};

export default config;
