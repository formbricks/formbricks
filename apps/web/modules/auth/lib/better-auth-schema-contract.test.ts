import { getAuthTables } from "@better-auth/core/db";
import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt } from "better-auth/plugins/jwt";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
 * The same drift is possible on the CORE tables, and there it has already bitten us twice: 1.7.0 keyed
 * accounts on `(issuer, accountId)`, and `Account.issuer` was a core field no plugin declares — so the
 * plugin-only pass below would not have caught a missing column. `getAuthTables` is upstream's own
 * resolver for the merged core+plugin schema, so the core assertions track whatever the installed
 * version declares, exactly like the plugin ones.
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
 * The object literal at `path` inside the `betterAuth({...})` call in auth.ts, as property name → source
 * text. Parsed rather than grepped, so a comment or another object that happens to hold the same text
 * cannot stand in for the real option, and auth.ts is never imported (that would boot the instance).
 */
const betterAuthOptionEntry = (path: string[]): Record<string, string> => {
  const fileName = join(dirname(fileURLToPath(import.meta.url)), "auth.ts");
  const source = ts.createSourceFile(fileName, readFileSync(fileName, "utf8"), ts.ScriptTarget.Latest, true);

  let options: ts.ObjectLiteralExpression | undefined;
  const findCall = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "betterAuth" &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      options = node.arguments[0];
      return;
    }
    ts.forEachChild(node, findCall);
  };
  findCall(source);
  if (!options) throw new Error("betterAuth({...}) call not found in auth.ts");

  const entry = path.reduce<ts.ObjectLiteralExpression>((object, key) => {
    const property = object.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(source) === key
    );
    if (!property || !ts.isObjectLiteralExpression(property.initializer)) {
      throw new Error(`betterAuth option ${path.join(".")} is missing or not an object literal in auth.ts`);
    }
    return property.initializer;
  }, options);

  return Object.fromEntries(
    entry.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => [p.name.getText(source), p.initializer.getText(source)])
  );
};

/**
 * Both plugins expose their merged schema on the instance, so this tracks whatever the installed
 * version declares. `oauthProvider` needs its two mandatory options to construct.
 */
const declaredModels = {
  ...jwt().schema,
  ...oauthProvider({ loginPage: "/auth/login", consentPage: "/account/authorize" }).schema,
} as Record<string, { fields?: Record<string, unknown> }>;

/**
 * The core-table field mapping from `auth.ts`, mirrored rather than imported: importing `auth.ts` would
 * construct the real instance and pull in env, Prisma and Redis, which a schema-shape unit test has no
 * business booting. The mirror is guarded against the source below, so it cannot rot silently.
 */
const CORE_FIELD_MAPPING = {
  session: { token: "sessionToken", expiresAt: "expires" },
  account: {
    providerId: "provider",
    accountId: "providerAccountId",
    accessToken: "access_token",
    refreshToken: "refresh_token",
    idToken: "id_token",
  },
} as const;

/** Our own additional account fields, mirrored from `auth.ts` and guarded the same way. */
const ACCOUNT_ADDITIONAL_FIELDS = {
  issuer: { type: "string", required: false, input: false, returned: false },
} as const;

const coreTables = getAuthTables({
  session: { fields: { ...CORE_FIELD_MAPPING.session } },
  account: { fields: { ...CORE_FIELD_MAPPING.account }, additionalFields: { ...ACCOUNT_ADDITIONAL_FIELDS } },
});

/**
 * Core fields Better Auth declares that we deliberately do not persist, with the mitigation that makes
 * that safe. An entry here is only defensible while its mitigation is in place, so each one is asserted
 * below rather than merely allowed — an exclusion nobody re-checks is how a declared field becomes a
 * failing INSERT.
 */
const CORE_FIELDS_NOT_PERSISTED = {
  // `User.imageUrl` was dropped in 20250813071701_remove_user_image_url. Better Auth still maps a
  // provider image (Google picture / GitHub avatar / OIDC picture), and the SSO user-create hook
  // strips it to `undefined` so `transformInput` drops it before Prisma sees it.
  user: { image: { file: "../../ee/sso/lib/better-auth-hooks.ts", strips: "image: undefined" } },
} as const;

/** BA's model keys are lower-case; our Prisma models are PascalCase. */
const prismaModelName = (model: string): string => model.charAt(0).toUpperCase() + model.slice(1);

describe("Better Auth ↔ Prisma schema contract", () => {
  describe("core tables", () => {
    // Guard the mirror: a mapping changed in auth.ts and not here would make the assertions below
    // compare BA's canonical names against columns we never named that way — and pass for the wrong
    // reason on any field that happens to be absent from both sides.
    test.each(
      Object.entries(CORE_FIELD_MAPPING).flatMap(([model, fields]) =>
        Object.entries(fields).map(([logical, column]) => [model, logical, column])
      )
    )("auth.ts still maps %s.%s onto %s", (_model, logical, column) => {
      const authSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "auth.ts"), "utf8");

      expect(authSource).toContain(`${logical}: "${column}"`);
    });

    // `verification` is deliberately absent: with Redis `secondaryStorage` configured Better Auth keeps
    // verification records there and never touches a table, so there is no Prisma model to check
    // (auth.ts:70-72). `session` IS checked, because `storeSessionInDatabase` opts it back into the DB.
    test.each(["user", "session", "account"])(
      "our Prisma model for %s carries every core field Better Auth declares",
      (model) => {
        const notPersisted = Object.keys(
          CORE_FIELDS_NOT_PERSISTED[model as keyof typeof CORE_FIELDS_NOT_PERSISTED] ?? {}
        );
        const declared = Object.entries(coreTables[model].fields)
          .filter(([name]) => !notPersisted.includes(name))
          .map(([name, attribute]) => attribute.fieldName ?? name);
        const ours = prismaModelFields(prismaSchema, prismaModelName(model));

        expect(declared.filter((field) => !ours.includes(field))).toEqual([]);
      }
    );

    // Bind each exclusion above to the code that makes it safe: if the strip is removed, the field is
    // back to being a missing column and the exclusion has to go with it.
    test.each(
      Object.entries(CORE_FIELDS_NOT_PERSISTED).flatMap(([model, fields]) =>
        Object.entries(fields).map(([field, { file, strips }]) => [model, field, file, strips])
      )
    )("%s.%s is still stripped before the insert", (_model, _field, file, strips) => {
      const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), "utf8");

      expect(source).toContain(strips);
    });

    // Better Auth 1.7.3 dropped `account.issuer` from its core model and keys accounts on
    // `(providerId, accountId)`. A 1.7.0 pod still filters on it, so we declare it ourselves and write it
    // on every account create: the superset test above then covers the column like any core field.
    test("account.issuer is ours, not Better Auth's, and the auth.ts declaration is still there", () => {
      expect(Object.keys(getAuthTables({}).account.fields)).not.toContain("issuer");
      expect(Object.keys(coreTables.account.fields)).toContain("issuer");
      expect(betterAuthOptionEntry(["account", "additionalFields", "issuer"])).toEqual({
        type: '"string"',
        required: "false",
        input: "false",
        returned: "false",
      });
    });
  });

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
