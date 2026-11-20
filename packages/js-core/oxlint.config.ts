import { compose, denyWarnings } from "@formbricks/config-oxlint/base";
import cspSafe from "@formbricks/config-oxlint/csp-safe";
import library from "@formbricks/config-oxlint/library";
import { defineConfig } from "oxlint";

export default defineConfig(
  denyWarnings(
    compose(library, cspSafe, {
      overrides: [
        {
          files: ["**/*.test.ts"],
          rules: {
            // vitest assertions (`expect(obj.method).toHaveBeenCalled…`, `vi.mocked(obj.method)`)
            // reference methods without invoking them, so no `this` can go astray.
            "typescript/unbound-method": "off",
          },
        },
      ],
    })
  )
);
