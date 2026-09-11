import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const publishWorkflowPath = ".github/workflows/publish-v6-upgrade-assistant.yml";
const releaseWorkflowPath = ".github/workflows/formbricks-release.yml";
const ecrReleaseWorkflowPath = ".github/workflows/build-and-push-ecr.yml";
const dockerBuildValidationWorkflowPath = ".github/workflows/docker-build-validation.yml";
const dockerReleaseWorkflowPath = ".github/workflows/release-docker-github.yml";
const helmReleaseWorkflowPath = ".github/workflows/release-helm-chart.yml";
const moveStableWorkflowPath = ".github/workflows/move-stable-tag.yml";
const releaseAssetReconcilerPath = join(repositoryRoot, "scripts/reconcile-github-release-assets.sh");
const helmPackageNormalizerPath = join(repositoryRoot, "scripts/normalize-helm-package.sh");
const tempDirectories: string[] = [];
const hasGnuTar = spawnSync("tar", ["--version"], { encoding: "utf8" }).stdout.includes("GNU tar");
const promotionCondition =
  "${{\n  always() &&\n  !github.event.release.prerelease &&\n  needs.docker-build-community.result == 'success' &&\n  needs.helm-chart-release.result == 'success' &&\n  (\n    (!startsWith(github.event.release.tag_name, '6.') && !startsWith(github.event.release.tag_name, 'v6.')) ||\n    needs.publish-v6-upgrade-assistant.result == 'success'\n  )\n}}";

type TWorkflow = {
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs?: Record<
    string,
    | {
        if?: string;
        concurrency?: { group?: string; "cancel-in-progress"?: boolean };
        needs?: string[];
        outputs?: Record<string, string>;
        permissions?: Record<string, string>;
        steps?: { env?: Record<string, string>; name?: string; uses?: string; run?: string }[];
        uses?: string;
        with?: Record<string, string>;
      }
    | undefined
  >;
  on?: unknown;
  true?: unknown;
  outputs?: Record<string, unknown>;
};

const readWorkflow = (relativePath: string): TWorkflow =>
  load(readFileSync(join(repositoryRoot, relativePath), "utf8")) as TWorkflow;

const createTempDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-release-assets-"));
  tempDirectories.push(directory);
  return directory;
};

const createFakeGh = (
  directory: string
): Readonly<{
  binDirectory: string;
  commandLog: string;
  remoteDirectory: string;
}> => {
  const binDirectory = join(directory, "bin");
  const commandLog = join(directory, "gh-commands.log");
  const remoteDirectory = join(directory, "remote-assets");
  mkdirSync(binDirectory);
  mkdirSync(remoteDirectory);
  writeFileSync(commandLog, "");
  const fakeGhPath = join(binDirectory, "gh");
  writeFileSync(
    fakeGhPath,
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$GH_COMMAND_LOG"

if [ "$1 $2" = "release view" ]; then
  [ "\${GH_FAIL_VIEW:-}" != "true" ] || exit 1
  for asset in "$GH_REMOTE_ASSET_DIRECTORY"/*; do
    [ -e "$asset" ] || continue
    basename "$asset"
  done
  exit 0
fi

if [ "$1 $2" = "release download" ]; then
  [ "\${GH_FAIL_DOWNLOAD:-}" != "true" ] || exit 1
  pattern=""
  output=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --pattern) pattern="$2"; shift 2 ;;
      --output) output="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  cp "$GH_REMOTE_ASSET_DIRECTORY/$pattern" "$output"
  exit 0
fi

if [ "$1 $2" = "release upload" ]; then
  for argument in "$@"; do
    case "$argument" in
      /*) asset_path="$argument" ;;
    esac
  done
  cp "$asset_path" "$GH_REMOTE_ASSET_DIRECTORY/$(basename "$asset_path")"
  [ "\${GH_UPLOAD_COMMIT_THEN_FAIL:-}" != "true" ] || exit 1
  exit 0
fi

exit 1
`
  );
  chmodSync(fakeGhPath, 0o755);

  return { binDirectory, commandLog, remoteDirectory };
};

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("v6 upgrade assistant release workflow", () => {
  test("boots the authoritative validation image only after a real fresh-install activation", () => {
    const validationJob = readWorkflow(dockerBuildValidationWorkflowPath).jobs?.["validate-docker-build"];
    const skipMigration = validationJob?.steps?.find(
      ({ name }) => name === "Preserve Startup Migration Skip Behavior"
    )?.run;
    const healthSmoke = validationJob?.steps?.find(
      ({ name }) => name === "Test Docker Image with Health Check"
    )?.run;

    expect(skipMigration).toContain("Authoritative startup did not fail closed promptly");
    expect(skipMigration).toContain("Waiting for the AuthZed activation receipt");
    expect(skipMigration).toContain("Authoritative image bypassed its activation receipt");
    expect(healthSmoke).toContain("authzed/release-images.json");
    expect(healthSmoke).toContain("datastore migrate head");
    expect(healthSmoke).toContain("packages/database/dist/scripts/apply-migrations.js");
    expect(healthSmoke).toContain('"$IMAGE" activation bootstrap');
    expect(healthSmoke).toContain('AUTHZED_CONSISTENCY="fully_consistent"');
    expect(healthSmoke).toContain("Waiting for the AuthZed activation receipt");
  });

  test("publishes only from the hardened, minimally privileged signed-bundle job", () => {
    const publishJob = readWorkflow(publishWorkflowPath).jobs?.publish;

    expect(publishJob?.steps?.[0]).toMatchObject({
      name: "Harden the runner",
      uses: "step-security/harden-runner@ec9f2d5744a09debf3a187a3f4f675c53b671911",
    });
    expect(publishJob?.permissions).toEqual({ contents: "write", "id-token": "write", packages: "read" });
    expect(publishJob?.if).toBe(
      "github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main'"
    );
    expect(publishJob?.concurrency).toEqual({
      group: "v6-upgrade-assets-${{ inputs.release_tag }}",
      "cancel-in-progress": false,
    });

    const steps = publishJob?.steps ?? [];
    expect(steps.find(({ name }) => name === "Install cosign")?.uses).toBe(
      "sigstore/cosign-installer@3454372f43399081ed03b604cb2d021dabca52bb"
    );
    expect(steps.find(({ name }) => name === "Validate release and signed immutable images")?.run).toContain(
      "cosign verify"
    );
    const signingCommand = steps.find(({ name }) => name === "Sign and verify checksums")?.run;
    expect(signingCommand).toContain("cosign sign-blob");
    expect(signingCommand).toContain("gh release download");
    const uploadCommand = steps.find(({ name }) => name === "Attach signed bundle to the release")?.run;
    expect(uploadCommand).toContain("scripts/reconcile-github-release-assets.sh");
    expect(uploadCommand).toContain('"dist/v6-upgrade/formbricks-${release_version}.tgz"');
    expect(uploadCommand).toContain('"dist/v6-upgrade/formbricks-upgrade-${release_version}.tgz"');
    expect(uploadCommand).not.toContain("--clobber");

    const reconciler = readFileSync(releaseAssetReconcilerPath, "utf8");
    expect(reconciler).toContain("gh release download");
    expect(reconciler).toContain("cmp --silent");
    expect(reconciler).toContain("gh release upload");
    expect(reconciler).not.toContain("--clobber");
  });

  test("resumes partial publication and skips byte-identical release assets", () => {
    const directory = createTempDirectory();
    const localDirectory = join(directory, "local-assets");
    mkdirSync(localDirectory);
    const existingAsset = join(localDirectory, "existing.txt");
    const missingAsset = join(localDirectory, "missing.txt");
    writeFileSync(existingAsset, "signed-existing-artifact\n");
    writeFileSync(missingAsset, "signed-missing-artifact\n");
    const { binDirectory, commandLog, remoteDirectory } = createFakeGh(directory);
    writeFileSync(join(remoteDirectory, "existing.txt"), readFileSync(existingAsset));

    const environment = {
      ...process.env,
      GH_COMMAND_LOG: commandLog,
      GH_REMOTE_ASSET_DIRECTORY: remoteDirectory,
      PATH: `${binDirectory}:${process.env.PATH}`,
    };
    const firstRun = spawnSync(
      releaseAssetReconcilerPath,
      ["v6.0.0", "formbricks/formbricks", existingAsset, missingAsset],
      { encoding: "utf8", env: environment }
    );

    expect(firstRun.status).toBe(0);
    expect(readFileSync(join(remoteDirectory, "existing.txt"), "utf8")).toBe("signed-existing-artifact\n");
    expect(readFileSync(join(remoteDirectory, "missing.txt"), "utf8")).toBe("signed-missing-artifact\n");
    expect(readFileSync(commandLog, "utf8")).toContain("release upload v6.0.0");

    writeFileSync(commandLog, "");
    const resumedRun = spawnSync(
      releaseAssetReconcilerPath,
      ["v6.0.0", "formbricks/formbricks", existingAsset, missingAsset],
      { encoding: "utf8", env: environment }
    );

    expect(resumedRun.status).toBe(0);
    expect(readFileSync(commandLog, "utf8")).not.toContain("release upload");
  });

  test("fails without overwriting an existing release asset whose bytes differ", () => {
    const directory = createTempDirectory();
    const localDirectory = join(directory, "local-assets");
    mkdirSync(localDirectory);
    const asset = join(localDirectory, "manifest.json");
    writeFileSync(asset, "new-signed-manifest\n");
    const { binDirectory, commandLog, remoteDirectory } = createFakeGh(directory);
    writeFileSync(join(remoteDirectory, "manifest.json"), "previous-release-manifest\n");

    const result = spawnSync(releaseAssetReconcilerPath, ["v6.0.0", "formbricks/formbricks", asset], {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_COMMAND_LOG: commandLog,
        GH_REMOTE_ASSET_DIRECTORY: remoteDirectory,
        PATH: `${binDirectory}:${process.env.PATH}`,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Existing release asset differs");
    expect(readFileSync(join(remoteDirectory, "manifest.json"), "utf8")).toBe("previous-release-manifest\n");
    expect(readFileSync(commandLog, "utf8")).not.toContain("release upload");
  });

  test("accepts an upload whose response fails only after the asset was committed", () => {
    const directory = createTempDirectory();
    const localDirectory = join(directory, "local-assets");
    mkdirSync(localDirectory);
    const asset = join(localDirectory, "manifest.json");
    writeFileSync(asset, "signed-manifest\n");
    const { binDirectory, commandLog, remoteDirectory } = createFakeGh(directory);

    const result = spawnSync(releaseAssetReconcilerPath, ["v6.0.0", "formbricks/formbricks", asset], {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_COMMAND_LOG: commandLog,
        GH_REMOTE_ASSET_DIRECTORY: remoteDirectory,
        GH_UPLOAD_COMMIT_THEN_FAIL: "true",
        PATH: `${binDirectory}:${process.env.PATH}`,
      },
    });

    expect(result.status).toBe(0);
    expect(readFileSync(join(remoteDirectory, "manifest.json"), "utf8")).toBe("signed-manifest\n");
    expect(readFileSync(commandLog, "utf8")).toContain("release upload v6.0.0");
  });

  test.runIf(hasGnuTar)("normalizes equivalent Helm packages to identical bytes", () => {
    const directory = createTempDirectory();
    const fixtures = [
      {
        packagePath: join(directory, "first.tgz"),
        root: join(directory, "first"),
        timestamp: new Date("2026-01-01T00:00:00Z"),
      },
      {
        packagePath: join(directory, "second.tgz"),
        root: join(directory, "second"),
        timestamp: new Date("2026-01-02T00:00:00Z"),
      },
    ] as const;

    fixtures.forEach(({ packagePath, root, timestamp }) => {
      const chartDirectory = join(root, "formbricks");
      mkdirSync(chartDirectory, { recursive: true });
      const chartFile = join(chartDirectory, "Chart.yaml");
      writeFileSync(chartFile, "apiVersion: v2\nname: formbricks\nversion: 6.0.0\n");
      utimesSync(chartFile, timestamp, timestamp);
      utimesSync(chartDirectory, timestamp, timestamp);
      const archive = spawnSync("tar", ["-czf", packagePath, "-C", root, "formbricks"], {
        encoding: "utf8",
      });
      expect(archive.status).toBe(0);
      const normalized = spawnSync(helmPackageNormalizerPath, [packagePath, "formbricks"], {
        encoding: "utf8",
      });
      expect(normalized.status).toBe(0);
    });

    expect(readFileSync(fixtures[0].packagePath)).toEqual(readFileSync(fixtures[1].packagePath));
  });

  test.each([
    ["asset inventory", { GH_FAIL_VIEW: "true" }],
    ["existing asset download", { GH_FAIL_DOWNLOAD: "true" }],
  ])("fails closed when the %s cannot be read", (_label, failureEnvironment) => {
    const directory = createTempDirectory();
    const localDirectory = join(directory, "local-assets");
    mkdirSync(localDirectory);
    const asset = join(localDirectory, "manifest.json");
    writeFileSync(asset, "signed-manifest\n");
    const { binDirectory, commandLog, remoteDirectory } = createFakeGh(directory);
    writeFileSync(join(remoteDirectory, "manifest.json"), "signed-manifest\n");

    const result = spawnSync(releaseAssetReconcilerPath, ["v6.0.0", "formbricks/formbricks", asset], {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_COMMAND_LOG: commandLog,
        GH_REMOTE_ASSET_DIRECTORY: remoteDirectory,
        PATH: `${binDirectory}:${process.env.PATH}`,
        ...failureEnvironment,
      },
    });

    expect(result.status).toBe(1);
    expect(readFileSync(commandLog, "utf8")).not.toContain("release upload");
  });

  test("builds release-matched target and bridge images and publishes both immutable digests", () => {
    const releaseWorkflow = readWorkflow(releaseWorkflowPath);
    const publishJob = releaseWorkflow.jobs?.["publish-v6-upgrade-assistant"];
    const bridgeJob = releaseWorkflow.jobs?.["docker-build-authzed-bridge"];
    const communityJob = releaseWorkflow.jobs?.["docker-build-community"];
    const cloudJob = releaseWorkflow.jobs?.["docker-build-cloud"];

    expect(publishJob?.uses).toBe("./.github/workflows/publish-v6-upgrade-assistant.yml");
    expect(publishJob?.needs).toEqual(["docker-build-community", "docker-build-authzed-bridge"]);
    expect(publishJob?.if).toContain("github.event.release.tag_name");
    expect(publishJob?.with).toMatchObject({
      bridge_image_ref:
        "ghcr.io/${{ github.repository }}@${{ needs.docker-build-authzed-bridge.outputs.IMAGE_DIGEST }}",
      target_image_ref:
        "ghcr.io/${{ github.repository }}@${{ needs.docker-build-community.outputs.IMAGE_DIGEST }}",
    });
    expect(bridgeJob).toMatchObject({
      if: expect.stringContaining("github.event.release.tag_name"),
      uses: "./.github/workflows/release-docker-github.yml",
      with: {
        AUTHZED_RELEASE_MODE: "legacy_bridge",
        IS_PRERELEASE: "${{ github.event.release.prerelease }}",
        MAKE_LATEST: false,
        PUBLISH_RELEASE_ALIASES: false,
        TAG_SUFFIX: "-authzed-bridge",
      },
    });
    expect(cloudJob?.with?.AUTHZED_RELEASE_MODE).toBe(communityJob?.with?.AUTHZED_RELEASE_MODE);
    expect(cloudJob?.with?.IS_PRERELEASE).toBe(false);
    expect(cloudJob?.with?.MAKE_LATEST).toBe(false);

    const ecrRelease = readFileSync(join(repositoryRoot, ecrReleaseWorkflowPath), "utf8");
    expect(ecrRelease).toContain("AUTHZED_RELEASE_MODE:");
    expect(ecrRelease).toContain('default: "spicedb_authoritative"');
    expect(ecrRelease).toContain("authzed_release_mode: ${{ inputs.AUTHZED_RELEASE_MODE }}");

    const dockerRelease = readWorkflow(dockerReleaseWorkflowPath);
    expect(dockerRelease.jobs?.build?.outputs?.IMAGE_DIGEST).toBe("${{ steps.build.outputs.image_digest }}");
    expect(readFileSync(join(repositoryRoot, dockerReleaseWorkflowPath), "utf8")).toContain(
      "value: ${{ jobs.build.outputs.IMAGE_DIGEST }}"
    );
    const dockerAction = readFileSync(
      join(repositoryRoot, ".github/actions/build-and-push-docker/action.yml"),
      "utf8"
    );
    expect(dockerAction).toContain("FORMBRICKS_AUTHZED_RELEASE_MODE=${{ inputs.authzed_release_mode }}");
    expect(dockerAction).toContain("FORMBRICKS_BUILD_REVISION=${{ github.sha }}");
    const assistantRelease = readFileSync(join(repositoryRoot, publishWorkflowPath), "utf8");
    expect(assistantRelease).toContain("docker buildx imagetools inspect");
    expect(assistantRelease).toContain("authzed/release-images.json");
    expect(assistantRelease).not.toContain("pgvector/pgvector:pg18");
    expect(assistantRelease).not.toContain("authzed/spicedb:v1.52.0");
    const releaseImages = JSON.parse(
      readFileSync(join(repositoryRoot, "authzed/release-images.json"), "utf8")
    ) as Record<string, string>;
    expect(releaseImages.postgresBootstrap).toMatch(/^pgvector\/pgvector@sha256:[0-9a-f]{64}$/);
    expect(releaseImages.spicedb).toMatch(/^authzed\/spicedb@sha256:[0-9a-f]{64}$/);
    expect(assistantRelease).toContain('index("linux/amd64")');
    expect(assistantRelease).toContain('index("linux/arm64")');
    expect(assistantRelease).toContain('"${container_id}:/home/nextjs/authzed-cli/release-manifest.json"');
    expect(assistantRelease).toContain("legacy_bridge BRIDGE_RUNTIME_MANIFEST_DIGEST");
    expect(assistantRelease).toContain("spicedb_authoritative TARGET_RUNTIME_MANIFEST_DIGEST");
    expect(assistantRelease).toContain('--bridge-runtime-manifest-digest "$BRIDGE_RUNTIME_MANIFEST_DIGEST"');
    expect(assistantRelease).toContain('--target-runtime-manifest-digest "$TARGET_RUNTIME_MANIFEST_DIGEST"');
    expect(assistantRelease).toContain('--postgres-bootstrap-image "$POSTGRES_BOOTSTRAP_IMAGE_REF"');
    expect(assistantRelease).toContain('--spicedb-image "$SPICEDB_IMAGE_REF"');
  });

  test("gates every moving alias on the complete release artifact set", () => {
    const releaseWorkflow = readWorkflow(releaseWorkflowPath);
    const moveStableWorkflow = readWorkflow(moveStableWorkflowPath);
    const communityJob = releaseWorkflow.jobs?.["docker-build-community"];
    const promotionJob = releaseWorkflow.jobs?.["promote-stable-image"];
    const sourcePromotionJob = releaseWorkflow.jobs?.["move-stable-tag"];
    const linearCompletionJob = releaseWorkflow.jobs?.["linear-release-complete"];

    expect(communityJob?.with?.MAKE_LATEST).toBe(false);
    expect(communityJob?.with?.PUBLISH_RELEASE_ALIASES).toBe(false);
    expect(communityJob?.with?.AUTHZED_RELEASE_MODE).toBe(
      "${{ (startsWith(github.event.release.tag_name, '6.') || startsWith(github.event.release.tag_name, 'v6.')) && 'spicedb_authoritative' || 'legacy_bridge' }}"
    );
    expect(releaseWorkflow.jobs?.["docker-build-authzed-bridge"]?.with?.AUTHZED_RELEASE_MODE).toBe(
      "legacy_bridge"
    );
    expect(releaseWorkflow.jobs?.["docker-build-authzed-bridge"]?.with?.PUBLISH_RELEASE_ALIASES).toBe(false);
    expect(promotionJob?.needs).toEqual([
      "check-latest-release",
      "docker-build-community",
      "publish-v6-upgrade-assistant",
      "helm-chart-release",
    ]);
    expect(promotionJob?.if).toBe(promotionCondition);
    expect(promotionJob?.concurrency).toEqual({
      group: "formbricks-release-moving-aliases-${{ github.repository }}",
      "cancel-in-progress": false,
    });
    expect(promotionJob?.permissions).toEqual({ contents: "read", packages: "write" });
    expect(promotionJob?.outputs).toEqual({
      aliases_complete: "${{ steps.promote.outputs.aliases_complete }}",
      promoted: "${{ steps.promote.outputs.promoted }}",
      source_stable: "${{ steps.promote.outputs.source_stable }}",
    });
    expect(promotionJob?.steps?.[0]).toMatchObject({
      name: "Harden the runner",
      uses: "step-security/harden-runner@ec9f2d5744a09debf3a187a3f4f675c53b671911",
    });
    const promotionCommand = promotionJob?.steps?.find(
      ({ name }) => name === "Promote and verify stable image alias"
    )?.run;
    const promotionEnvironment = promotionJob?.steps?.find(
      ({ name }) => name === "Promote and verify stable image alias"
    )?.env;
    expect(promotionEnvironment?.KEEP_LATEST_ON_V5).toBe("true");
    expect(promotionCommand?.trim()).toBe("scripts/promote-release-image-aliases.sh");
    expect(promotionJob?.steps?.some(({ uses }) => uses?.startsWith("actions/checkout@"))).toBe(true);
    expect(sourcePromotionJob?.needs).toEqual(["check-latest-release", "promote-stable-image"]);
    expect(sourcePromotionJob?.if).toContain("needs.promote-stable-image.outputs.promoted == 'true'");
    expect(sourcePromotionJob?.if).toContain("needs.promote-stable-image.outputs.source_stable == 'true'");
    expect(sourcePromotionJob?.with?.make_latest).toBe(true);
    expect(linearCompletionJob?.needs).toContain("publish-v6-upgrade-assistant");
    expect(linearCompletionJob?.needs).toContain("promote-stable-image");
    expect(linearCompletionJob?.needs).not.toContain("check-latest-release");
    expect(linearCompletionJob?.if).toContain("needs.publish-v6-upgrade-assistant.result == 'success'");
    expect(linearCompletionJob?.if).toContain(
      "needs.promote-stable-image.outputs.aliases_complete == 'true'"
    );
    expect(linearCompletionJob?.if).not.toContain("needs.promote-stable-image.outputs.promoted == 'true'");
    expect(linearCompletionJob?.if).not.toContain("needs.promote-stable-image.result == 'success'");

    const initialLatestCheck = releaseWorkflow.jobs?.["check-latest-release"]?.steps?.find(
      ({ name }) => name === "Get latest release tag from API"
    )?.run;
    expect(initialLatestCheck).toContain('curl -sS -w "%{http_code}"');
    expect(initialLatestCheck).toContain('elif [[ "$http_code" == "200" ]]');
    expect(initialLatestCheck).toContain('if [[ "$latest_release" == "null" || -z "$latest_release" ]]');
    expect(initialLatestCheck).toContain('echo "latest_release=" >> $GITHUB_OUTPUT');
    expect(initialLatestCheck).toContain("exit 1");

    const dockerAction = readFileSync(
      join(repositoryRoot, ".github/actions/build-and-push-docker/action.yml"),
      "utf8"
    );
    expect(dockerAction).not.toContain("ghcr.io/${IMAGE_NAME}:stable");

    expect(moveStableWorkflow.concurrency).toEqual({
      group: "move-stable-tag-${{ github.repository }}",
      "cancel-in-progress": false,
    });
    const moveStableCommand = moveStableWorkflow.jobs?.["move-stable-tag"]?.steps?.find(
      ({ name }) => name === "Move stable tag"
    )?.run;
    expect(moveStableCommand).toContain(
      'git fetch --force origin "refs/tags/${RELEASE_TAG}:refs/tags/${RELEASE_TAG}"'
    );
    expect(moveStableCommand).toContain(
      'release_commit=$(git rev-parse "refs/tags/${RELEASE_TAG}^{commit}")'
    );
    expect(moveStableCommand).toContain('if [[ "$release_commit" != "$COMMIT_SHA" ]]');
    expect(moveStableCommand).toContain('curl -sS -w "%{http_code}"');
    expect(moveStableCommand).toContain('if [[ "$http_code" != "200" ]]');
    expect(moveStableCommand).toContain("jq -er '.tag_name | select(type == \"string\" and length > 0)'");
    expect(moveStableCommand).toContain('if [[ "$latest_tag" != "$RELEASE_TAG" ]]');
    expect(moveStableCommand).toContain("git push origin stable --force");
    expect(moveStableCommand?.indexOf('if [[ "$latest_tag" != "$RELEASE_TAG" ]]')).toBeLessThan(
      moveStableCommand?.indexOf("git push origin stable --force") ?? -1
    );
    expect(readFileSync(join(repositoryRoot, moveStableWorkflowPath), "utf8")).toContain("^[vV]?[0-9]+");
  });

  test("publishes the temporary upgrade chart only in the signed v6 release bundle", () => {
    const helmRelease = readFileSync(join(repositoryRoot, helmReleaseWorkflowPath), "utf8");
    const assistantRelease = readFileSync(join(repositoryRoot, publishWorkflowPath), "utf8");

    expect(helmRelease).not.toContain("charts/formbricks-upgrade");
    expect(helmRelease).not.toContain("formbricks-upgrade-${VERSION}.tgz");
    expect(assistantRelease).toContain("helm package charts/formbricks-upgrade");
    expect(assistantRelease).toContain("helm package charts/formbricks");
    expect(assistantRelease).toContain("scripts/normalize-helm-package.sh");
    expect(assistantRelease).toContain('"formbricks-${release_version}.tgz"');
    expect(assistantRelease).toContain('"formbricks-upgrade-${release_version}.tgz"');
    expect(assistantRelease).not.toContain("dist/v6-upgrade/formbricks-[0-9]*.tgz");
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks-authzed-overlay.yml");
    expect(assistantRelease).toContain("dist/v6-upgrade/authzed-postgres-bootstrap.sh");
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks.sh");
    expect(assistantRelease).not.toContain("dist/v6-upgrade/formbricks-upgrade-*.tgz");
  });
});
