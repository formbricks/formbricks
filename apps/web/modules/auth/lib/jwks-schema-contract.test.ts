import { jwt } from "better-auth/plugins/jwt";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * The `jwks` schema contract between Better Auth and our Prisma model (ENG-2343).
 *
 * Better Auth owns this table: the jwt plugin declares its fields, and `createJwk` writes a row
 * through whichever adapter is configured — for us, Prisma. So a field the plugin declares and our
 * model lacks is not a cosmetic mismatch, it is a failed INSERT: Prisma rejects the unknown argument,
 * the key mint fails, JWT signing fails, and the whole MCP OAuth flow goes down with it.
 *
 * This nearly shipped. `alg` and `crv` arrived in 1.7 and our model did not have them, and NOTHING in
 * the suite noticed, because nothing here writes a real jwks row: the unit suites mock
 * `@formbricks/database` wholesale, the DCR harness runs on `memoryAdapter` (which does not enforce
 * columns), and no integration test mints a key. It surfaces only against a real database on a
 * deployment that has not minted one yet — a fresh self-host, or the first sign after a rotation.
 *
 * So this test reads the plugin's own declaration rather than restating a field list: the next field
 * upstream adds fails here, at `pnpm test`, instead of at someone's first MCP token request.
 */
const prismaSchemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../packages/database/schema/main.prisma"
);

/** Field names on a Prisma model, skipping comments, attributes, relations and the block braces. */
const prismaModelFields = (source: string, model: string): string[] => {
  const block = new RegExp(`^model ${model} \\{$([\\s\\S]*?)^\\}$`, "m").exec(source);
  if (!block) throw new Error(`model ${model} not found in main.prisma`);

  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0]);
};

describe("jwks schema contract (Better Auth ↔ Prisma)", () => {
  test("our Prisma model carries every field the jwt plugin declares", () => {
    // The plugin's own merged schema, read off the instance rather than a hand-copied list, so this
    // tracks whatever the installed version declares.
    const declared = Object.keys(jwt().schema?.jwks?.fields ?? {});
    const ours = prismaModelFields(readFileSync(prismaSchemaPath, "utf8"), "jwks");

    // Guard the guard: if the upstream export ever stops being introspectable the assertion below
    // would pass against an empty list, proving nothing.
    expect(declared).toEqual(expect.arrayContaining(["publicKey", "privateKey", "createdAt"]));

    expect(declared.filter((field) => !ours.includes(field))).toEqual([]);
  });
});
