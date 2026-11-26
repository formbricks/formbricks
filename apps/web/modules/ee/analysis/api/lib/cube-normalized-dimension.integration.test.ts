import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";

/**
 * Compiles the Cube model for a dataset with one embedded-data key, takes the SQL of the hidden normalized
 * dimension it registers (what a Dashboard Viewer's access condition compares against), and runs it on real
 * PostgreSQL. Its output must equal what the viewer side computes in JavaScript: `value.trim().toLowerCase()`
 * (ADR-0061).
 */
const localRequire = createRequire(import.meta.url);
const cubeConfigPath = localRequire.resolve("../../../../../../../docker/cube/cube.js");
const cubeSchemaPath = localRequire.resolve("../../../../../../../docker/cube/schema/FeedbackRecords.js");

type TDimension = { sql: (cubeAlias: string) => string; shown?: boolean };
type TCubeDefinition = { dimensions: Record<string, TDimension> };

const EMBEDDED_KEY = "Country";
let normalizedDimensionSql: (cubeAlias: string) => string;

beforeAll(async () => {
  process.env.CUBEJS_API_SECRET = process.env.CUBEJS_API_SECRET || "cube-secret";
  const cubeConfig: unknown = localRequire(cubeConfigPath);
  const schemaSource = readFileSync(cubeSchemaPath, "utf8");
  const compileContext = {
    securityContext: { feedbackDirectoryId: "frd-1", tenantId: "frd-1", edKeys: [EMBEDDED_KEY] },
  };
  // Cube's compiler exposes each cube's name (CUBE, AnswerFilter1, …) as a global; stand them in as strings.
  const cubeNameGlobals: Record<string, string> = {};
  let cubes: Record<string, TCubeDefinition> = {};
  for (let attempt = 0; ; attempt++) {
    cubes = {};
    let compile: (() => Promise<void>) | undefined;
    try {
      runInNewContext(schemaSource, {
        ...cubeNameGlobals,
        require: (path: string) => {
          if (path !== "/cube/conf/cube.js") throw new Error(`unexpected require: ${path}`);
          return cubeConfig;
        },
        asyncModule: (fn: () => Promise<void>) => {
          compile = fn;
        },
        cube: (name: string, definition: TCubeDefinition) => {
          cubes[name] = definition;
        },
        COMPILE_CONTEXT: compileContext,
      });
      if (!compile) throw new Error("the schema registered no asyncModule");
      await compile();
      break;
    } catch (error) {
      const missing = /^(\w+) is not defined$/.exec(error instanceof Error ? error.message : "");
      if (!missing || attempt > 100) throw error;
      cubeNameGlobals[missing[1]] = missing[1];
    }
  }

  const { getEmbeddedDimensionSpecs } = cubeConfig as {
    getEmbeddedDimensionSpecs: (context: unknown) => Array<{ key: string; normalizedName: string }>;
  };
  const [spec] = getEmbeddedDimensionSpecs(compileContext);
  const dimension = cubes.FeedbackRecords?.dimensions[spec.normalizedName];
  if (!dimension) throw new Error(`FeedbackRecords registered no ${spec.normalizedName} dimension`);
  normalizedDimensionSql = dimension.sql;
});

/** The dimension's SQL over one feedback record whose embedded value for the key is `value`. */
const normalizeInPostgres = async (value: string): Promise<string> => {
  const rows = await prisma.$queryRawUnsafe<Array<{ normalized: string }>>(
    `SELECT ${normalizedDimensionSql("r")} AS normalized FROM (SELECT $1::jsonb AS metadata) AS r`,
    JSON.stringify({ embedded_data: { [EMBEDDED_KEY]: value } })
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
    await expect(normalizeInPostgres(`${JS_WHITESPACE}Sweden${JS_WHITESPACE}`)).resolves.toBe("sweden");
  });
});
