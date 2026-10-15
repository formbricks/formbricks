import { readFile } from "node:fs/promises";
import { beforeEach, expect, test, vi } from "vitest";
import { runKubernetesOnlineCli } from "./cli";
import { summarizeOnlineState } from "./coordinator";
import { KubernetesUpgrade, onlineConfigSchema } from "./kubernetes";
import { readOnlineStatus, runOnlineCommand } from "./runtime";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("./runtime", () => ({ readOnlineStatus: vi.fn(), runOnlineCommand: vi.fn() }));

const image = `app@sha256:${"b".repeat(64)}`;
const releasedDigest = `sha256:${"a".repeat(64)}`;
const config = onlineConfigSchema.parse({
  namespace: "fixture",
  sourceVersion: "6.0.2",
  targetImage: image,
  sessionAffinity: true,
  sourceDigests: [`sha256:${"c".repeat(64)}`],
  deployment: "web",
  service: "web",
  workloads: [{ kind: "deployments", name: "web", image, replicas: 2 }],
  dependencies: [{ kind: "deployments", name: "hub", image }],
  ingress: { selector: "app=envoy", cluster: "web", proxyResourceNames: ["envoy:19000"] },
});
const root = new URL("file:///release/");
const template = { metadata: { name: "target" } };
let kube: KubernetesUpgrade;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  kube = new KubernetesUpgrade(config, "fixture", "fixture", new URL("https://kubernetes.default.svc"));
  vi.spyOn(KubernetesUpgrade, "connect").mockResolvedValue(kube);
  vi.mocked(readFile).mockImplementation((file) =>
    Promise.resolve(
      JSON.stringify(
        String(file).endsWith("source-images.json")
          ? { "6.0.2": [releasedDigest] }
          : String(file).endsWith("deployment.json")
            ? template
            : config
      )
    )
  );
  vi.mocked(runOnlineCommand).mockResolvedValue(summarizeOnlineState(null));
});

test.each([[], ["unexpected"], ["prepare", "extra"]])(
  "invalid arguments fail before configuration or cluster reads: %j",
  async (...args) => {
    expect(await runKubernetesOnlineCli(args, root)).toMatchObject({
      blockerCode: "invalid_online_command",
      rollbackTo60Allowed: false,
    });
    expect(readFile).not.toHaveBeenCalled();
    expect(KubernetesUpgrade.connect).not.toHaveBeenCalled();
  }
);

test("configuration failures name only the error's class and code, and never claim rollback safety", async () => {
  vi.mocked(readFile).mockRejectedValueOnce(
    Object.assign(new Error("private mounted secret"), { code: "ENOENT" })
  );
  const result = await runKubernetesOnlineCli(["prepare"], root);
  expect(result).toMatchObject({
    blockerCode: "invalid_online_configuration",
    rollbackTo60Allowed: false,
    cause: { name: "Error", code: "ENOENT" },
  });
  expect(JSON.stringify(result)).not.toContain("private mounted secret");
  expect(KubernetesUpgrade.connect).not.toHaveBeenCalled();
});

test("source identities must come from the bundled release manifest", async () => {
  vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(config)).mockResolvedValueOnce("{}");
  expect(await runKubernetesOnlineCli(["prepare"], root)).toMatchObject({
    blockerCode: "unsupported_source_release",
  });
  expect(KubernetesUpgrade.connect).not.toHaveBeenCalled();
});

test.each(["prepare", "finalize"] as const)("dispatches %s with verified source digests", async (command) => {
  expect(await runKubernetesOnlineCli([command], root)).toEqual(summarizeOnlineState(null));
  expect(KubernetesUpgrade.connect).toHaveBeenCalledWith(
    expect.objectContaining({ sourceDigests: [releasedDigest] })
  );
  expect(runOnlineCommand).toHaveBeenCalledWith(
    command,
    expect.objectContaining({ targetImage: image, sourceVersion: "6.0.2" }),
    root
  );
});

test("wires lock assertions into every platform mutation and loads the target pod template", async () => {
  const assertLock = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(kube, "preflight").mockResolvedValue(undefined);
  vi.spyOn(kube, "verifySourceConsumersAbsent").mockResolvedValue(undefined);
  vi.spyOn(kube, "waitForConsumers").mockResolvedValue(undefined);
  for (const method of ["handoff", "retireSourceConsumers", "cleanup", "releaseAccess"] as const) {
    vi.spyOn(kube, method).mockImplementation(async () => {
      expect(kube.assertLock).toBe(assertLock);
      await kube.assertLock();
    });
  }
  vi.mocked(runOnlineCommand).mockImplementation(async (_command, platform) => {
    await platform.preflight(true);
    await platform.handoff!(assertLock);
    await platform.retireSourceConsumers(assertLock);
    await platform.verifySourceConsumersAbsent();
    await platform.verifyConsumers();
    await platform.cleanup!(assertLock);
    await platform.releaseAccess!(assertLock);
    return summarizeOnlineState(null);
  });
  await runKubernetesOnlineCli(["prepare"], root);
  expect(kube.preflight).toHaveBeenCalledWith(true);
  expect(kube.handoff).toHaveBeenCalledWith(template);
  expect(kube.verifySourceConsumersAbsent).toHaveBeenCalledOnce();
  expect(kube.waitForConsumers).toHaveBeenCalledOnce();
  expect(assertLock).toHaveBeenCalledTimes(4);
});

test("status remains usable after temporary Kubernetes configuration and access are removed", async () => {
  vi.mocked(readOnlineStatus).mockResolvedValue(summarizeOnlineState(null));
  await expect(runKubernetesOnlineCli(["status"], root)).resolves.toMatchObject({ status: "not_started" });
  expect(readFile).not.toHaveBeenCalled();
  expect(KubernetesUpgrade.connect).not.toHaveBeenCalled();
  expect(readOnlineStatus).toHaveBeenCalledOnce();
});
