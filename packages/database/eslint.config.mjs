import library from "@formbricks/eslint-config/library";

// The library tier (eslint + typescript-eslint recommendedTypeChecked) does not enable `no-console`,
// so the CLI/migration scripts here that log intentionally need no package-wide override.
export default library({ tsconfigRootDir: import.meta.dirname });
