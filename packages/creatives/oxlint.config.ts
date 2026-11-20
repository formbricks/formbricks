import { defineConfig } from "oxlint";
import { compose, denyWarnings } from "@formbricks/config-oxlint/base";
import cspSafe from "@formbricks/config-oxlint/csp-safe";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(denyWarnings(compose(library, cspSafe)));
