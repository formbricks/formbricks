// eslint-disable-next-line typescript/no-require-imports -- a CommonJS config file, loaded by Prettier with require
const baseConfig = require("../../.prettierrc.js");

module.exports = {
  ...baseConfig,
  tailwindStylesheet: "./modules/ui/globals.css",
};
