/* @see https://github.com/tailwindlabs/prettier-plugin-tailwindcss/issues/31#issuecomment-1024722576 */
const tailwind = require("prettier-plugin-tailwindcss");

const combinedFormatter = {
  parsers: {
    typescript: {
      ...tailwind.parsers.typescript,
    },
  },
};

module.exports = combinedFormatter;
