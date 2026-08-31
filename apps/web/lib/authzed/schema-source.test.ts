import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, test, vi } from "vitest";
import { configureCanonicalAuthzedSchemaUrl, readCanonicalAuthzedSchema } from "./schema-source";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

describe("canonical AuthZed schema source", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { authzedCanonicalSchemaUrl?: URL }).authzedCanonicalSchemaUrl;
  });

  test("can point a packaged CLI at its release-matched schema asset", async () => {
    vi.mocked(readFile).mockResolvedValue("definition user {}" as never);

    configureCanonicalAuthzedSchemaUrl("file:///home/nextjs/authzed-cli/index.mjs", "./schema.zed");

    await expect(readCanonicalAuthzedSchema()).resolves.toBe("definition user {}");
    expect(readFile).toHaveBeenCalledWith(new URL("file:///home/nextjs/authzed-cli/schema.zed"), "utf8");
  });
});
