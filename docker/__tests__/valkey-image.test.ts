import { load } from "js-yaml";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const valkeyIndexDigest = "sha256:169567d6288e5f08aa141847c0c3e0864a32e727682ca6f052a20567c7103ef8";
const valkeyImage = `valkey/valkey@${valkeyIndexDigest}`;
const legacyValkeyImage =
  "valkey/valkey@sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d";

const sharedDirectPinFiles = [
  ".github/workflows/docker-build-validation.yml",
  ".github/workflows/e2e.yml",
  ".github/workflows/integration-tests.yml",
  "charts/formbricks/tests/envoy-kind-integration.sh",
  "docker-compose.dev.yml",
  "docker/docker-compose.yml",
  "docker/formbricks.sh",
  "docker/migrate-to-v4.sh",
  "docker/smoke-release-image.sh",
];
const mainOnlyDirectPinFile = ".github/workflows/api-v3-contract-tests.yml";

describe("bundled Valkey image", () => {
  test.each([
    ...sharedDirectPinFiles,
    ...(existsSync(join(repositoryRoot, mainOnlyDirectPinFile)) ? [mainOnlyDirectPinFile] : []),
  ])("uses the multi-architecture index in %s", (relativePath) => {
    const pins = Array.from(
      readFileSync(join(repositoryRoot, relativePath), "utf8").matchAll(
        /valkey\/valkey@sha256:[a-f0-9]{64}/gi
      ),
      (match) => match[0]
    );
    // Only the one-click updater keeps the legacy 8.1.1 pin beside the current one.
    const allowedPins =
      relativePath === "docker/formbricks.sh" ? [valkeyImage, legacyValkeyImage] : [valkeyImage];

    expect(new Set(pins)).toEqual(new Set(allowedPins));
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
