import library from "@formbricks/config-eslint/library";

export default [
  ...library({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ["**/*.test.ts"],
    rules: {
      // vitest assertions (`expect(obj.method).toHaveBeenCalled…`, `vi.mocked(obj.method)`)
      // reference methods without invoking them, so no `this` can go astray.
      "@typescript-eslint/unbound-method": "off",
    },
  },
];
