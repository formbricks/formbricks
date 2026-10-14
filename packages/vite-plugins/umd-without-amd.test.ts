import vm from "node:vm";
import { type Plugin, type Rollup, build } from "vite";
import { describe, expect, test, vi } from "vitest";
import { UMD_WITHOUT_AMD_OUTPUT } from "./umd-without-amd";

const ENTRY_ID = "/virtual/umd-fixture-entry.ts";

const virtualEntry: Plugin = {
  name: "virtual-umd-fixture-entry",
  resolveId: (source) => (source === ENTRY_ID ? ENTRY_ID : null),
  load: (id) => (id === ENTRY_ID ? "export const answer = 42;" : null),
};

const bundleUmd = async (output: Rollup.OutputOptions): Promise<string> => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [virtualEntry],
    build: {
      write: false,
      lib: { entry: ENTRY_ID, name: "umdFixture", formats: ["umd"], fileName: "fixture" },
      rollupOptions: { output },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs
    .flatMap((entry) => ("output" in entry ? entry.output : []))
    .find((item) => item.type === "chunk");
  if (!chunk) throw new Error("vite build produced no chunk");
  return chunk.code;
};

describe("UMD_WITHOUT_AMD_OUTPUT", () => {
  test("assigns the browser global on a page with an AMD loader, without calling define", async () => {
    const code = await bundleUmd(UMD_WITHOUT_AMD_OUTPUT);
    const define = Object.assign(vi.fn(), { amd: {} });
    const sandbox: { define: typeof define; umdFixture?: { answer: number } } = { define };

    vm.runInContext(code, vm.createContext(sandbox));

    expect(define).not.toHaveBeenCalled();
    expect(sandbox.umdFixture?.answer).toBe(42);
  });

  test("still fills module.exports when loaded as CommonJS", async () => {
    const code = await bundleUmd(UMD_WITHOUT_AMD_OUTPUT);
    const module: { exports: { answer?: number } } = { exports: {} };

    vm.runInContext(code, vm.createContext({ module, exports: module.exports }));

    expect(module.exports.answer).toBe(42);
  });
});
