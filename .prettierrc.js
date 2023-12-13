const baseConfig = require("./packages/prettier-config/prettier-preset");

module.exports = {
  ...baseConfig,
  plugins: ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
};
