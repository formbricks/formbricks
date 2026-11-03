import cspSafe from "@formbricks/config-eslint/csp-safe";
import library from "@formbricks/config-eslint/library";

export default [...library({ tsconfigRootDir: import.meta.dirname }), ...cspSafe];
