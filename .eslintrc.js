module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-formbricks`
  extends: ["formbricks"],
  settings: {
    next: {
      rootDir: ["apps/*/"],
    },
  },
};
