import { defineConfig } from "oxlint";
import { denyWarnings } from "@formbricks/config-oxlint/base";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(denyWarnings(library));
