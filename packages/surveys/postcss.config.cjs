// basic regex -- [whitespace](number)(rem)[whitespace or ;]
const REM_REGEX = /(\d*\.?\d+\s?)(rem)/gi;
const PROCESSED = Symbol("processed");

const remtoEm = (opts = {}) => {
  // This function converts rem units to em units in CSS declarations and media queries
  const { transformMediaQuery = false } = opts;

  return {
    postcssPlugin: "postcss-rem-to-em-plugin",
    Declaration(decl) {
      if (!decl[PROCESSED]) {
        decl.value = decl.value.replace(REM_REGEX, "$1em");
        decl[PROCESSED] = true;
      }
    },

    AtRule: {
      media: (atRule) => {
        if (!atRule[PROCESSED] && transformMediaQuery) {
          atRule.params = atRule.params.replace(REM_REGEX, "$1em");
          atRule[PROCESSED] = true;
        }
      },
    },
  };
};

module.exports = {
  plugins: [require("@tailwindcss/postcss"), require("autoprefixer"), remtoEm()],
};
