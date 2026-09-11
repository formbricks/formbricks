import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const publishWorkflowPath = ".github/workflows/publish-v6-upgrade-assistant.yml";
const releaseWorkflowPath = ".github/workflows/formbricks-release.yml";
const dockerReleaseWorkflowPath = ".github/workflows/release-docker-github.yml";
const helmReleaseWorkflowPath = ".github/workflows/release-helm-chart.yml";

type TWorkflow = {
  jobs?: Record<
    string,
    | {
        if?: string;
        needs?: string[];
        outputs?: Record<string, string>;
        permissions?: Record<string, string>;
        steps?: { name?: string; uses?: string; run?: string }[];
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

describe("v6 upgrade assistant release workflow", () => {
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

    const steps = publishJob?.steps ?? [];
    expect(steps.find(({ name }) => name === "Install cosign")?.uses).toBe(
      "sigstore/cosign-installer@3454372f43399081ed03b604cb2d021dabca52bb"
    );
    expect(steps.find(({ name }) => name === "Validate release and signed immutable images")?.run).toContain(
      "cosign verify"
    );
    expect(steps.find(({ name }) => name === "Sign and verify checksums")?.run).toContain("cosign sign-blob");
    const uploadCommand = steps.find(({ name }) => name === "Attach signed bundle to the release")?.run;
    expect(uploadCommand).toContain("gh release upload");
    expect(uploadCommand).not.toContain("--clobber");
  });

  test("builds release-matched target and bridge images and publishes both immutable digests", () => {
    const releaseWorkflow = readWorkflow(releaseWorkflowPath);
    const publishJob = releaseWorkflow.jobs?.["publish-v6-upgrade-assistant"];
    const bridgeJob = releaseWorkflow.jobs?.["docker-build-authzed-bridge"];

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
    expect(assistantRelease).toContain('"${container_id}:/home/nextjs/authzed-cli/release-manifest.json"');
    expect(assistantRelease).toContain("legacy_bridge BRIDGE_RUNTIME_MANIFEST_DIGEST");
    expect(assistantRelease).toContain("spicedb_authoritative TARGET_RUNTIME_MANIFEST_DIGEST");
    expect(assistantRelease).toContain('--bridge-runtime-manifest-digest "$BRIDGE_RUNTIME_MANIFEST_DIGEST"');
    expect(assistantRelease).toContain('--target-runtime-manifest-digest "$TARGET_RUNTIME_MANIFEST_DIGEST"');
  });

  test("does not move the latest image alias during the v6 migration window", () => {
    const releaseWorkflow = readWorkflow(releaseWorkflowPath);
    const communityJob = releaseWorkflow.jobs?.["docker-build-community"];

    expect(communityJob?.with?.MAKE_LATEST).toBe(
      "${{ needs.check-latest-release.outputs.is_latest == 'true' && !startsWith(github.event.release.tag_name, '6.') && !startsWith(github.event.release.tag_name, 'v6.') }}"
    );
  });

  test("publishes the temporary upgrade chart only for v6 and signs the release copy", () => {
    const helmRelease = readFileSync(join(repositoryRoot, helmReleaseWorkflowPath), "utf8");
    const assistantRelease = readFileSync(join(repositoryRoot, publishWorkflowPath), "utf8");

    expect(helmRelease).toContain('if [[ "$VERSION" == 6.* ]]');
    expect(helmRelease).toContain("helm lint ./charts/formbricks-upgrade");
    expect(helmRelease).toContain('helm push "formbricks-upgrade-${VERSION}.tgz"');
    expect(assistantRelease).toContain("helm package charts/formbricks-upgrade");
    expect(assistantRelease).toContain("helm package charts/formbricks");
    expect(assistantRelease).toContain('"formbricks-${release_version}.tgz"');
    expect(assistantRelease).toContain('"formbricks-upgrade-${release_version}.tgz"');
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks-[0-9]*.tgz");
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks-authzed-overlay.yml");
    expect(assistantRelease).toContain("dist/v6-upgrade/authzed-postgres-bootstrap.sh");
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks.sh");
    expect(assistantRelease).toContain("dist/v6-upgrade/formbricks-upgrade-*.tgz");
  });
});
