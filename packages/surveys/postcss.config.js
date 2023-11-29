// basic regex -- [whitespace](number)(rem)[whitespace or ;]
const REM_REGEX = /(\d*\.?\d+\s?)(rem)/gi;
const PROCESSED = Symbol("processed");

const remtoEm = (opts = {}) => {
  // Work with options here
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
          console.log("atrule pre", atRule.params);
          atRule.params = atRule.params.replace(REM_REGEX, "$1em");
          console.log("atrule post", atRule.params);
          atRule[PROCESSED] = true;
        }
      },
    },
  };
};

module.exports = {
  plugins: [require("tailwindcss"), require("autoprefixer"), remtoEm()],
};
