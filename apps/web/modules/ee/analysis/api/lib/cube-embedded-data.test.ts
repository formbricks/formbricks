import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { describe, expect, test } from "vitest";
import {
  collectEmbeddedChartFields,
  toCubeEmbeddedFields,
} from "@/modules/ee/analysis/lib/embedded-data-fields";

/**
 * The Cube half of Embedded Data charts (ENG-2848): cube.js picks a compiled schema per field list and
 * refuses a malformed claim; the schema turns each entry into one dimension. Both files run for real.
 */
const require = createRequire(import.meta.url);
const cubeConfigPath = require.resolve("../../../../../../../docker/cube/cube.js");
const cubeSchemaPath = require.resolve("../../../../../../../docker/cube/schema/FeedbackRecords.js");
process.env.CUBEJS_API_SECRET = process.env.CUBEJS_API_SECRET || "cube-secret";

const { contextToAppId, contextToOrchestratorId } = require(cubeConfigPath) as {
  contextToAppId: (context: { securityContext?: Record<string, unknown> }) => string;
  contextToOrchestratorId: (context: { securityContext?: Record<string, unknown> }) => string;
};

type TCubeDimension = { sql: string | ((cubeAlias: string) => string); type: string };

const evaluateDimensions = (compileContext: unknown): Record<string, TCubeDimension> => {
  let captured: { dimensions: Record<string, TCubeDimension> } | undefined;
  const sandbox = {
    CUBE: "TBL",
    COMPILE_CONTEXT: compileContext,
    cube: (_name: string, definition: { dimensions: Record<string, TCubeDimension> }) => {
      captured = definition;
    },
  };
  createContext(sandbox);
  runInContext(readFileSync(cubeSchemaPath, "utf8"), sandbox);
  if (!captured) throw new Error("No cube() definition found");
  return captured.dimensions;
};

const renderSql = (dimension: TCubeDimension) =>
  typeof dimension.sql === "function" ? dimension.sql("TBL") : dimension.sql;

const fieldsFor = (...entries: [string, "string" | "number" | "boolean"][]) =>
  toCubeEmbeddedFields(
    collectEmbeddedChartFields([
      { name: "Survey", fields: entries.map(([name, dataType]) => ({ name, dataType })) },
    ])
  );

describe("cube.js contextToAppId", () => {
  test("keeps the default app for a token without Embedded Data", () => {
    expect(contextToAppId({ securityContext: {} })).toBe("CUBEJS_APP");
    expect(contextToAppId({ securityContext: { embeddedFields: [] } })).toBe("CUBEJS_APP");
  });

  test("gives one app per field list, whatever its order", () => {
    const fields = fieldsFor(["brand", "string"], ["seats", "number"]);
    const appId = contextToAppId({ securityContext: { embeddedFields: fields } });

    expect(appId).toMatch(/^CUBEJS_APP_ed_[0-9a-f]{32}$/);
    expect(contextToAppId({ securityContext: { embeddedFields: [...fields].reverse() } })).toBe(appId);
    expect(contextToAppId({ securityContext: { embeddedFields: fieldsFor(["brand", "string"]) } })).not.toBe(
      appId
    );
    // A type change compiles a different dimension, so it must not reuse the compiled schema.
    expect(
      contextToAppId({
        securityContext: { embeddedFields: fieldsFor(["brand", "string"], ["seats", "string"]) },
      })
    ).not.toBe(appId);
  });

  test.each([
    ["a non-array", "brand"],
    ["a bad member id", [{ id: "ed_x'); DROP TABLE x; --", hex: "62", type: "string" }]],
    ["non-hex name", [{ id: "ed_0123456789abcdef", hex: "zz", type: "string" }]],
    ["odd-length hex", [{ id: "ed_0123456789abcdef", hex: "626", type: "string" }]],
    ["an unknown type", [{ id: "ed_0123456789abcdef", hex: "62", type: "time" }]],
    [
      "a duplicate id",
      [
        { id: "ed_0123456789abcdef", hex: "62", type: "string" },
        { id: "ed_0123456789abcdef", hex: "63", type: "string" },
      ],
    ],
    [
      "too many fields",
      Array.from({ length: 201 }, (_, i) => ({
        id: `ed_${String(i).padStart(16, "0")}`,
        hex: "62",
        type: "string",
      })),
    ],
  ])("refuses a token whose embeddedFields is %s", (_label, embeddedFields) => {
    expect(() => contextToAppId({ securityContext: { embeddedFields } })).toThrow(
      /invalid embeddedFields security context/
    );
  });

  test("shares one orchestrator across apps, so field lists do not multiply connection pools", () => {
    expect(
      contextToOrchestratorId({ securityContext: { embeddedFields: fieldsFor(["brand", "string"]) } })
    ).toBe(contextToOrchestratorId({ securityContext: {} }));
  });
});

describe("FeedbackRecords schema Embedded Data dimensions", () => {
  test("compiles no Embedded Data dimension without a compile context", () => {
    const dimensions = Object.keys(evaluateDimensions(undefined));
    expect(dimensions.some((name) => name.startsWith("ed_"))).toBe(false);
  });

  test("compiles one dimension per field, typed, reading the name through Postgres' decode", () => {
    const fields = fieldsFor(["brand", "string"], ["seats", "number"], ["trial", "boolean"]);
    const dimensions = evaluateDimensions({ securityContext: { embeddedFields: fields } });
    const [brand, seats, trial] = fields.map((field) => dimensions[field.id]);

    expect(brand.type).toBe("string");
    expect(renderSql(brand)).toBe(
      `(TBL.metadata->'embedded_data'->>convert_from(decode('${fields[0].hex}', 'hex'), 'UTF8'))`
    );
    expect(seats.type).toBe("number");
    expect(renderSql(seats)).toContain("::double precision");
    expect(renderSql(seats)).toContain("\\A-?[0-9]{1,15}");
    expect(trial.type).toBe("boolean");
    expect(renderSql(trial)).toContain("IN ('true', 'false')");
  });

  test("never puts the field name into the SQL as text", () => {
    const name = `x'); DROP TABLE feedback_records; -- $' \${CUBE}`;
    const fields = fieldsFor([name, "string"]);
    const sql = renderSql(evaluateDimensions({ securityContext: { embeddedFields: fields } })[fields[0].id]);

    expect(sql).not.toContain("DROP");
    expect(sql).not.toContain("$'");
    expect(sql).toMatch(/decode\('[0-9a-f]+', 'hex'\)/);
  });

  test("skips an entry it cannot validate itself, even if cube.js were bypassed", () => {
    const dimensions = evaluateDimensions({
      securityContext: {
        embeddedFields: [{ id: "ed_0123456789abcdef", hex: "6272'616e64", type: "string" }],
      },
    });
    expect(dimensions.ed_0123456789abcdef).toBeUndefined();
  });
});
