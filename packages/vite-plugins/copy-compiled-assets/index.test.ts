import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { copyCompiledAssetsPlugin } from "./index";

// The plugin writes to `{config.root}/../../apps/web/public/js`, so a root two levels below a temp
// directory keeps every write inside it.
let tempDir: string;
let root: string;
let publicJsDir: string;

const write = async (dir: string, files: Record<string, string>) => {
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), content);
  }
};

const run = async (options: Parameters<typeof copyCompiledAssetsPlugin>[0]) => {
  const plugin = copyCompiledAssetsPlugin(options) as Required<
    Pick<Plugin, "configResolved" | "writeBundle">
  >;
  (plugin.configResolved as (config: ResolvedConfig) => void)({ root } as ResolvedConfig);
  await (plugin.writeBundle as () => Promise<void>)();
};

const list = async (dir: string) => (await readdir(dir)).sort();

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "copy-compiled-assets-"));
  root = path.join(tempDir, "packages", "surveys");
  publicJsDir = path.join(tempDir, "apps", "web", "public", "js");
  await write(path.join(root, "dist"), { "index.umd.cjs": "bundle" });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempDir, { recursive: true, force: true });
});

describe("copyCompiledAssetsPlugin", () => {
  test("copies the bundle under the configured name and creates no asset directories without options", async () => {
    await run({ filename: "surveys", distDir: path.join(root, "dist") });

    expect(await list(publicJsDir)).toEqual(["surveys.umd.cjs"]);
  });

  describe("locales", () => {
    const localesDir = () => path.join(root, "locales");

    test("copies only the .json files into /js/locales", async () => {
      await write(localesDir(), { "en-US.json": '{"a":1}', "de-DE.json": '{"a":2}', "notes.md": "ignored" });

      await run({ filename: "surveys", distDir: path.join(root, "dist"), localesDir: localesDir() });

      const out = path.join(publicJsDir, "locales");
      expect(await list(out)).toEqual(["de-DE.json", "en-US.json"]);
      expect(await readFile(path.join(out, "de-DE.json"), "utf8")).toBe('{"a":2}');
    });

    test("replaces the directory: a file left by an earlier build does not survive", async () => {
      await write(path.join(publicJsDir, "locales"), { "gone.json": "stale", "en-US.json": "old" });
      await write(localesDir(), { "en-US.json": "new" });

      await run({ filename: "surveys", distDir: path.join(root, "dist"), localesDir: localesDir() });

      const out = path.join(publicJsDir, "locales");
      expect(await list(out)).toEqual(["en-US.json"]);
      expect(await readFile(path.join(out, "en-US.json"), "utf8")).toBe("new");
    });
  });

  describe("fonts", () => {
    const fontsDir = () => path.join(root, "assets", "fonts");

    test("copies the .woff2 files and their .txt licenses into /js/fonts, and nothing else", async () => {
      await write(fontsDir(), {
        "DancingScript-latin.woff2": "font",
        "OFL.txt": "license",
        "DancingScript.ttf": "ignored",
        "README.md": "ignored",
      });

      await run({ filename: "surveys", distDir: path.join(root, "dist"), fontsDir: fontsDir() });

      const out = path.join(publicJsDir, "fonts");
      expect(await list(out)).toEqual(["DancingScript-latin.woff2", "OFL.txt"]);
      expect(await readFile(path.join(out, "OFL.txt"), "utf8")).toBe("license");
    });

    test("replaces the directory: a font left by an earlier build does not survive", async () => {
      await write(path.join(publicJsDir, "fonts"), { "Old.woff2": "stale" });
      await write(fontsDir(), { "New.woff2": "font" });

      await run({ filename: "surveys", distDir: path.join(root, "dist"), fontsDir: fontsDir() });

      expect(await list(path.join(publicJsDir, "fonts"))).toEqual(["New.woff2"]);
    });
  });

  test("replaces locales and fonts independently in one run", async () => {
    await write(path.join(root, "locales"), { "en-US.json": "{}" });
    await write(path.join(root, "assets", "fonts"), { "A.woff2": "font" });

    await run({
      filename: "surveys",
      distDir: path.join(root, "dist"),
      localesDir: path.join(root, "locales"),
      fontsDir: path.join(root, "assets", "fonts"),
    });

    expect(await list(path.join(publicJsDir, "locales"))).toEqual(["en-US.json"]);
    expect(await list(path.join(publicJsDir, "fonts"))).toEqual(["A.woff2"]);
    expect(await list(publicJsDir)).toEqual(["fonts", "locales", "surveys.umd.cjs"]);
  });
});
