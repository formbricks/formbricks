import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { JsonObject } from "../src/testing/json";
import { renderZodModule } from "./render";

const spec = (schemas: JsonObject): JsonObject => ({
  openapi: "3.1.1",
  info: { title: "t", version: "1" },
  paths: {},
  components: { schemas },
});

const render = (schemas: JsonObject): Promise<string> => renderZodModule(spec(schemas), "// header");

describe("renderZodModule resolvers", () => {
  test("additionalProperties: false becomes a strict object, with or without properties", async () => {
    const source = await render({
      Closed: { type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
      Empty: { type: "object", properties: {}, additionalProperties: false },
    });
    expect(source).toMatch(/zClosed = z\.strictObject\(\{\s*a: z\.string\(\)/);
    expect(source).toMatch(/zEmpty = z\.strictObject\(\{\s*\}\)/);
  });

  test("additionalProperties: true keeps unknown keys", async () => {
    const source = await render({
      Loose: { type: "object", properties: { a: { type: "string" } }, additionalProperties: true },
    });
    expect(source).toMatch(/zLoose = z\.looseObject\(/);
  });

  test("an open object and a record keep the generator's defaults", async () => {
    const source = await render({
      Open: { type: "object", properties: { a: { type: "string" } } },
      Record: { type: "object", additionalProperties: { type: "string" } },
    });
    expect(source).toMatch(/zOpen = z\.object\(/);
    expect(source).toMatch(/zRecord = z\.record\(z\.string\(\), z\.string\(\)\)/);
  });

  test("format: cuid2 becomes z.cuid2()", async () => {
    const source = await render({ Id: { type: "string", format: "cuid2" } });
    expect(source).toMatch(/zId = z\.cuid2\(\)/);
  });

  test("the header is the first line and no readOnly or Writable twin is emitted", async () => {
    const source = await render({ Res: { type: "object", properties: { id: { type: "string" } } } });
    expect(source.startsWith("// header\n")).toBe(true);
    expect(source).not.toMatch(/readonly\(\)|Writable/);
  });
});

/**
 * c12 executes any `openapi-ts.config.*` it discovers, and imports the working directory itself when it
 * is given an empty config name. The explicit, non-existent `configFile` is what stops both; this runs
 * the renderer, in a child process so the working directory is real, from a directory holding a config
 * and an `index.mjs` that both throw.
 */
test("no config or module in the working directory is ever executed", () => {
  const directory = mkdtempSync(join(tmpdir(), "api-v3-schemas-render-"));
  try {
    writeFileSync(join(directory, "openapi-ts.config.mjs"), 'throw new Error("stray config executed");\n');
    // c12 imports the working directory as a module when it is handed an empty config name.
    writeFileSync(join(directory, "index.mjs"), 'throw new Error("stray index executed");\n');
    const renderModule = fileURLToPath(new URL("./render.ts", import.meta.url));
    const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
    const script = join(directory, "run.mts");
    writeFileSync(
      script,
      `import { renderZodModule } from ${JSON.stringify(renderModule)};
const out = await renderZodModule({ openapi: "3.1.1", info: { title: "t", version: "1" }, paths: {}, components: { schemas: { A: { type: "string" } } } }, "// h");
process.stdout.write(out.includes("zA") ? "ok" : "missing");\n`
    );
    const output = execFileSync(process.execPath, [tsxCli, script], { cwd: directory, encoding: "utf8" });
    expect(output).toBe("ok");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
