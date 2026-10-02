import { type Plugins, createClient } from "@hey-api/openapi-ts";
import { fileURLToPath } from "node:url";
import type { JsonObject } from "../src/testing/json";

/**
 * Runs hey-api in memory against an already scoped and normalized document and returns the source of
 * the one generated module.
 *
 * Everything that would make the output depend on the machine is pinned here: the input is an object
 * (no file or registry fetch), nothing is written (`dryRun`), no config file is discovered, no log file
 * is dropped on failure, and the tsconfig lookup is disabled.
 */

/**
 * An explicit config file that does not exist, so hey-api's config loader (c12, which executes what it
 * finds through jiti) loads nothing from the working directory.
 *
 * Both details are load-bearing. hey-api strips the last dot-segment before handing the name to c12,
 * so a path without an extension arrives as `""` — and c12 then imports the working directory itself,
 * executing whatever `index.*` sits there. And the directory must exist, or c12 fails with ENOTDIR.
 * `render.test.ts` plants a throwing config and a throwing `index.mjs` to keep both true.
 */
const NO_CONFIG_FILE = fileURLToPath(new URL("./__no-openapi-ts-config__.ts", import.meta.url));

const resolvers: Plugins.Zod.Resolvers = {
  // The contract's identifier format. hey-api knows only the formats JSON Schema defines.
  string(ctx) {
    if (ctx.schema.format === "cuid2") return ctx.$(ctx.plugin.imports.z).attr("cuid2").call();
    return undefined;
  },
  // hey-api's zod-v4 object resolver ignores `additionalProperties` whenever properties exist, so
  // `additionalProperties: false` would accept-and-strip unknown keys instead of rejecting them. The
  // v3 API turns an unknown key into a 400 `unsupported_field`; losing that is a mass-assignment
  // guard gone, not a cosmetic difference.
  object(ctx) {
    const additional = ctx.schema.additionalProperties;
    const hasProperties = Object.keys(ctx.schema.properties ?? {}).length > 0;
    // The IR spells `additionalProperties: false` as a `never` schema (or, on some paths, `false`).
    if (additional === false || additional?.type === "never") {
      return ctx.$(ctx.plugin.imports.z).attr("strictObject").call(ctx.nodes.shape(ctx));
    }
    if (!hasProperties) return undefined; // records and bare objects: the default resolver is correct
    if (additional?.type === "unknown")
      return ctx.$(ctx.plugin.imports.z).attr("looseObject").call(ctx.nodes.shape(ctx));
    // Open object: z.object strips, as the spec allows. A typed catchall beside properties would be
    // dropped by the default resolver too; normalize.ts rejects that shape before it gets here.
    return undefined;
  },
};

export const renderZodModule = async (document: JsonObject, header: string): Promise<string> => {
  const contexts = await createClient({
    configFile: NO_CONFIG_FILE,
    // hey-api mutates its input while parsing; the caller's document must survive for the check mode.
    input: structuredClone(document),
    dryRun: true,
    interactive: false,
    logs: { level: "silent", file: false },
    output: {
      path: "/dev/null/formbricks-api-v3-schemas", // never written: dryRun
      entryFile: false,
      clean: false,
      tsConfigPath: null,
      header,
    },
    parser: { transforms: { readWrite: false } },
    plugins: [
      {
        name: "zod",
        compatibilityVersion: 4,
        metadata: false,
        responses: false,
        dates: { offset: true },
        types: { infer: true },
        $resolvers: resolvers,
      },
    ],
  });

  // An InputError is reported by returning no context at all rather than by throwing.
  if (contexts.length !== 1)
    throw new Error(`hey-api produced ${contexts.length} contexts; expected exactly 1`);
  const files = [...contexts[0].gen.render()];
  const module = files.find((file) => file.path.endsWith("zod.gen.ts"));
  if (!module || files.length !== 1) {
    throw new Error(
      `hey-api rendered ${files.map((file) => file.path).join(", ") || "nothing"}; expected only zod.gen.ts`
    );
  }
  return module.content;
};
