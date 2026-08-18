import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt } from "better-auth/plugins/jwt";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * The schema contract between Better Auth's plugins and our Prisma models (ENG-2343).
 *
 * Better Auth owns these tables: each plugin declares the fields, and Better Auth writes rows through
 * whichever adapter is configured — for us, Prisma. So a field a plugin declares and our model lacks is
 * not a cosmetic mismatch, it is a failed INSERT: Prisma rejects the unknown argument at runtime.
 *
 * This class of drift nearly shipped. `jwks.alg` and `jwks.crv` arrived with the 1.7 line and our model
 * did not have them, and NOTHING in the suite noticed, because nothing here writes a real row to these
 * tables: the unit suites mock `@formbricks/database` wholesale, the MCP DCR harness runs on
 * `memoryAdapter` (which does not enforce columns), and no integration test mints a JWK. It surfaces
 * only against a real database — for `jwks`, on the first key mint of a deployment that has yet to make
 * one, which takes JWT signing and the whole MCP OAuth flow down with it.
 *
 * So these read each plugin's own declaration rather than restating a field list, and the next field
 * upstream adds fails at `pnpm test` instead of in production.
 *
 * Scope note: this checks that our model is a SUPERSET of what the plugin declares, which is the
 * direction that breaks writes. Extra columns of our own are fine and expected — `oauthClient` keeps
 * the legacy `public`/`type` for the rollback path, and every model carries an `id` and Prisma relation
 * fields the plugin never declares.
 */
const prismaSchemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../packages/database/schema/main.prisma"
);

/** Field names on a Prisma model, skipping comments, block attributes and the braces. */
const prismaModelFields = (source: string, model: string): string[] => {
  const block = new RegExp(`^model ${model} \\{$([\\s\\S]*?)^\\}$`, "m").exec(source);
  if (!block) throw new Error(`model ${model} not found in main.prisma`);

  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0]);
};

const prismaSchema = readFileSync(prismaSchemaPath, "utf8");

/**
 * Both plugins expose their merged schema on the instance, so this tracks whatever the installed
 * version declares. `oauthProvider` needs its two mandatory options to construct.
 */
const declaredModels = {
  ...jwt().schema,
  ...oauthProvider({ loginPage: "/auth/login", consentPage: "/account/authorize" }).schema,
} as Record<string, { fields?: Record<string, unknown> }>;

describe("Better Auth ↔ Prisma schema contract", () => {
  // Guard the guard: if either plugin stops exposing an introspectable schema, the per-model assertions
  // below would silently pass against empty field lists and prove nothing.
  test("both plugins expose the models we own", () => {
    expect(Object.keys(declaredModels).sort()).toEqual([
      "jwks",
      "oauthAccessToken",
      "oauthClient",
      "oauthClientAssertion",
      "oauthClientResource",
      "oauthConsent",
      "oauthRefreshToken",
      "oauthResource",
    ]);
    expect(Object.keys(declaredModels.jwks.fields ?? {})).toEqual(
      expect.arrayContaining(["publicKey", "privateKey", "createdAt", "alg", "crv"])
    );
  });

  test.each(Object.keys(declaredModels).sort())(
    "our Prisma model %s carries every field its plugin declares",
    (model) => {
      const declared = Object.keys(declaredModels[model].fields ?? {});
      const ours = prismaModelFields(prismaSchema, model);

      expect(declared.filter((field) => !ours.includes(field))).toEqual([]);
    }
  );
});
