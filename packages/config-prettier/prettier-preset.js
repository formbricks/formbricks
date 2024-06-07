module.exports = {
  bracketSpacing: true,
  bracketSameLine: true,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: "es5",
  semi: true,
  printWidth: 110,
  arrowParens: "always",
  importOrder: [
    // Mocks must be at the top as they contain vi.mock calls
    "(.*)/__mocks__/(.*)",
    "server-only",
    "<THIRD_PARTY_MODULES>",
    "^@formbricks/(.*)$",
    "^~/(.*)$",
    "^[./]",
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
};
