const postcss = require("postcss");

const remtoEm = postcss.plugin("rem-to-em", () => {
  return (root) => {
    root.walkDecls((decl) => {
      if (decl.value.includes("rem")) {
        decl.value = decl.value.replace(/([\d.]+)rem/g, (match, value) => {
          return `${parseFloat(value) * 1}em`; // 1rem = 1em in this case
        });
      }
    });
  };
});

module.exports = {
  plugins: [require("tailwindcss"), require("autoprefixer"), remtoEm],
};
