module.exports = {
  extends: ["@formbricks/eslint-config/legacy-next.js"],
  ignorePatterns: ["**/package.json", "**/tsconfig.json"],
  overrides: [
    {
      files: ["lib/messages/**/*.json"],
      plugins: ["i18n-json"],
      rules: {
        "i18n-json/identical-keys": [
          "error",
          {
            filePath: require("path").join(__dirname, "messages", "en-US.json"),
            checkExtraKeys: false,
            checkMissingKeys: true,
          },
        ],
      },
    },
  ],
};
