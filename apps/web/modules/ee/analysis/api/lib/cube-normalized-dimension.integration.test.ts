import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";

/**
 * Runs the Cube schema's normalized embedded-data expression (the `edv_` twin a Dashboard Viewer's access
 * condition compares against) on real PostgreSQL, and checks it gives what the viewer side computes with
 * JavaScript: `value.trim().toLowerCase()` (ADR-0061). The unit suite can only read the compiled SQL.
 */
const cubeSchemaPath = require.resolve("../../../../../../../docker/cube/schema/FeedbackRecords.js");

const normalizedSql = (valueSql: string): string => {
  const schemaSource = readFileSync(cubeSchemaPath, "utf8");
  const helperStart = schemaSource.indexOf("const JS_TRIM_WHITESPACE_CODE_POINTS");
  const helperEnd = schemaSource.indexOf("\n", schemaSource.indexOf("const trimLikeJavaScript"));
  if (helperStart < 0 || helperEnd < 0) throw new Error("trim helper not found in the Cube schema");
  const trimmed: unknown = runInNewContext(
    `${schemaSource.slice(helperStart, helperEnd)}\ntrimLikeJavaScript(${JSON.stringify(valueSql)});`
  );
  if (typeof trimmed !== "string") throw new Error("trim helper did not return SQL");
  return `LOWER(${trimmed})`;
};

const normalizeInPostgres = async (value: string): Promise<string> => {
  const rows = await prisma.$queryRawUnsafe<Array<{ normalized: string }>>(
    `SELECT ${normalizedSql("$1::text")} AS normalized`,
    value
  );
  return rows[0].normalized;
};

const JS_WHITESPACE = Array.from({ length: 0x10000 }, (_, codePoint) => codePoint)
  .filter((codePoint) => (codePoint < 0xd800 || codePoint > 0xdfff) && codePoint !== 0)
  .map((codePoint) => String.fromCodePoint(codePoint))
  .filter((character) => character.trim() === "")
  .join("");

describe("Cube normalized embedded-data dimension on PostgreSQL", () => {
  test.each([
    ["plain", "Sweden"],
    ["ordinary spaces", "  Sweden "],
    ["no-break spaces (U+00A0)", " Sweden "],
    ["tabs, newlines and a BOM", "\t\n﻿Sweden\r\n"],
    ["ideographic space and line separator", "　Sweden "],
    ["inner whitespace is kept", " New York "],
  ])("matches JavaScript trim().toLowerCase() for %s", async (_label, value) => {
    await expect(normalizeInPostgres(value)).resolves.toBe(value.trim().toLowerCase());
  });

  test("strips every character JavaScript's trim() strips, from both ends", async () => {
    const value = `${JS_WHITESPACE}Sweden${JS_WHITESPACE}`;
    await expect(normalizeInPostgres(value)).resolves.toBe("sweden");
  });
});
