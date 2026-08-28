import { load } from "js-yaml";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const valkeyIndexDigest = "sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84";
const valkeyImage = `valkey/valkey@${valkeyIndexDigest}`;
const legacyValkeyImage =
  "valkey/valkey@sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d";

const sharedDirectPinFiles = [
  ".github/workflows/docker-build-validation.yml",
  ".github/workflows/e2e.yml",
  ".github/workflows/integration-tests.yml",
  "docker-compose.dev.yml",
  "docker/docker-compose.yml",
  "docker/formbricks.sh",
  "docker/migrate-to-v4.sh",
];
const mainOnlyDirectPinFile = ".github/workflows/api-v3-contract-tests.yml";

describe("bundled Valkey image", () => {
  test.each([
    ...sharedDirectPinFiles,
    ...(existsSync(join(repositoryRoot, mainOnlyDirectPinFile)) ? [mainOnlyDirectPinFile] : []),
  ])("uses the multi-architecture index in %s", (relativePath) => {
    expect(readFileSync(join(repositoryRoot, relativePath), "utf8")).toContain(valkeyImage);
  });

  test("uses the same index in the Helm defaults and generated values table", () => {
    const values = load(readFileSync(join(repositoryRoot, "charts/formbricks/values.yaml"), "utf8")) as {
      redis?: { image?: { digest?: string; repository?: string } };
    };

    expect(values.redis?.image).toMatchObject({
      digest: valkeyIndexDigest,
      repository: "valkey/valkey",
    });
    expect(readFileSync(join(repositoryRoot, "charts/formbricks/README.md"), "utf8")).toContain(
      `\`"${valkeyIndexDigest}"\``
    );
  });

  test("keeps the updater's current and legacy migration pins explicit", () => {
    const updater = readFileSync(join(repositoryRoot, "docker/formbricks.sh"), "utf8");

    expect(updater).toContain(`legacy_valkey_image="${legacyValkeyImage}"`);
    expect(updater).toContain(`multi_arch_valkey_image="${valkeyImage}"`);
  });
});
