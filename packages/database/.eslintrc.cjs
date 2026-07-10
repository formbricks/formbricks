module.exports = {
  extends: ["@formbricks/eslint-config/next.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "no-console": "off",
    // This package owns the Prisma facade (src/prisma.ts re-exports @prisma/client/runtime, and the
    // adapter wiring lives here), so it is exempt from the workspace-wide @prisma/client import ban.
    "no-restricted-imports": "off",
  },
};
