import library from "@formbricks/eslint-config/library";

export default [
  ...library,
  {
    // CLI/migration scripts log intentionally (carried over from the legacy config)
    rules: {
      "no-console": "off",
    },
  },
];
