module.exports = (api) => {
  return {
    presets: [["@babel/preset-env", { targets: { node: "current" } }], "@babel/preset-typescript"],
    plugins: [["@babel/plugin-transform-react-jsx", { runtime: api.env("test") ? "automatic" : "classic" }]],
  };
};
