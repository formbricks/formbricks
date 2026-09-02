import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ZWebhook } from "./webhooks";

/**
 * Reads the enum straight out of the Prisma schema rather than the generated client: the schema is what
 * defines the database column's allowed values, and `generated/` is gitignored and not produced for this
 * package's unit tests, so importing it would only pass on a machine that had run `prisma generate`.
 */
const readSchemaEnumValues = (enumName: string): string[] => {
  const schema = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "schema", "main.prisma"),
    "utf8"
  );
  const block = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`).exec(schema);

  if (!block) {
    throw new Error(`enum ${enumName} not found in schema/main.prisma`);
  }

  return block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line.length > 0);
};

describe("ZWebhook", () => {
  // The Zod enum drifted from the Prisma enum once (`activepieces` was missing), which made parsing any
  // ActivePieces webhook row throw and advertised a wrong enum in the OpenAPI docs. Pin the two together
  // so the next added source fails here instead of in production.
  test("accepts every WebhookSource the database can hold", () => {
    const schemaValues = readSchemaEnumValues("WebhookSource");

    expect(schemaValues.length).toBeGreaterThan(0);
    expect([...ZWebhook.shape.source.options].sort()).toEqual([...schemaValues].sort());
  });
});
