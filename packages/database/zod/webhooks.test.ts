import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ZWebhook } from "./webhooks";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schema");

/**
 * Reads an enum straight out of the Prisma schema rather than the generated client: the schema is what
 * defines the database column's allowed values, and `generated/` is gitignored and not produced for this
 * package's unit tests, so importing it would only pass on a machine that had run `prisma generate`.
 *
 * Every `schema/*.prisma` file is searched, so relocating the enum between them does not break this.
 */
const readSchemaEnumValues = (enumName: string): string[] => {
  const block = readdirSync(SCHEMA_DIR)
    .filter((file) => file.endsWith(".prisma"))
    .map((file) =>
      new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`).exec(readFileSync(join(SCHEMA_DIR, file), "utf8"))
    )
    .find((match) => match !== null);

  if (!block) {
    throw new Error(`enum ${enumName} not found in any ${SCHEMA_DIR}/*.prisma`);
  }

  return (
    block[1]
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      // The value's Prisma-level name is the first token; an attribute such as `@map("USER")` renames it
      // only in the database, and Zod validates the Prisma-level name.
      .map((line) => line.split(/\s+/)[0])
      .filter((value) => value.length > 0)
  );
};

describe("ZWebhook", () => {
  // The Zod enum drifted from the Prisma enum once (`activepieces` was missing), which made parsing any
  // ActivePieces webhook row throw and advertised a wrong enum in the OpenAPI docs. Pin the two together
  // so the next added source fails here instead of in production.
  test("accepts every WebhookSource the database can hold", () => {
    const schemaValues = readSchemaEnumValues("WebhookSource");

    expect(schemaValues).toContain("activepieces");
    expect([...ZWebhook.shape.source.options].sort()).toEqual([...schemaValues].sort());
  });
});
