const baseConfig = require("./packages/prettier-config/prettier-preset");

module.exports = {
  ...baseConfig,
  plugins: ["prettier-plugin-tailwindcss"],
};
