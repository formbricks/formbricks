import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const publishWorkflowPath = ".github/workflows/publish-v6-upgrade-assistant.yml";
const releaseWorkflowPath = ".github/workflows/formbricks-release.yml";
const dockerReleaseWorkflowPath = ".github/workflows/release-docker-github.yml";

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

  test("passes the immutable community digest into v6 assistant publishing", () => {
    const releaseWorkflow = readWorkflow(releaseWorkflowPath);
    const publishJob = releaseWorkflow.jobs?.["publish-v6-upgrade-assistant"];

    expect(publishJob?.uses).toBe("./.github/workflows/publish-v6-upgrade-assistant.yml");
    expect(publishJob?.needs).toEqual(["docker-build-community"]);
    expect(publishJob?.if).toContain("github.event.release.tag_name");
    expect(publishJob?.with).toMatchObject({
      bridge_image_ref: "${{ vars.FORMBRICKS_V5_BRIDGE_IMAGE_REF }}",
      target_image_ref:
        "ghcr.io/${{ github.repository }}@${{ needs.docker-build-community.outputs.IMAGE_DIGEST }}",
    });

    const dockerRelease = readWorkflow(dockerReleaseWorkflowPath);
    expect(dockerRelease.jobs?.build?.outputs?.IMAGE_DIGEST).toBe("${{ steps.build.outputs.image_digest }}");
    expect(readFileSync(join(repositoryRoot, dockerReleaseWorkflowPath), "utf8")).toContain(
      "value: ${{ jobs.build.outputs.IMAGE_DIGEST }}"
    );
  });
});
