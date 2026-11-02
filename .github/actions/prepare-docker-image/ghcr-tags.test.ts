import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const script = fileURLToPath(new URL("./ghcr-tags.sh", import.meta.url));

const tags = (version: string, published: string[], { prerelease = false, latest = false } = {}) => {
  const result = spawnSync("bash", [script], {
    env: {
      ...process.env,
      VERSION: version,
      IMAGE_NAME: "formbricks/formbricks",
      IS_PRERELEASE: String(prerelease),
      MAKE_LATEST: String(latest),
    },
    input: published.join("\n"),
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  return result.stdout
    .trim()
    .split("\n")
    .map((tag) => tag.replace("ghcr.io/formbricks/formbricks:", ""));
};

// Published stable releases, as the releases API returns them (the current one included).
const published = ["5.4.1", "5.4.0", "v5.3.5", "5.3.4", "4.9.2", "stable", "5.5.0-rc.1"];

describe("GHCR release tags", () => {
  test("the newest release on the current line moves every alias", () => {
    expect(tags("5.4.2", [...published, "5.4.2"], { latest: true })).toEqual(["5.4.2", "5.4", "5", "latest"]);
  });

  test("an older-line backport advances its own minor alias but leaves the major alias alone", () => {
    expect(tags("5.3.6", [...published, "5.3.6"])).toEqual(["5.3.6", "5.3"]);
  });

  test("a replay of an older patch moves no alias", () => {
    expect(tags("5.3.4", published)).toEqual(["5.3.4"]);
  });

  test("the newest patch of an older major keeps its major alias current", () => {
    expect(tags("4.9.3", [...published, "4.9.3"])).toEqual(["4.9.3", "4.9", "4"]);
  });

  test("a prerelease never moves a rolling alias", () => {
    expect(tags("5.5.0-rc.2", published, { prerelease: true, latest: true })).toEqual(["5.5.0-rc.2"]);
  });

  test("the first release on a new line moves both aliases", () => {
    expect(tags("6.0.0", [])).toEqual(["6.0.0", "6.0", "6"]);
  });
});
