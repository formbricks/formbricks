import { expect, test, vi } from "vitest";
import { KubernetesUpgrade, onlineConfigSchema } from "./kubernetes";

const target = `app@sha256:${"b".repeat(64)}`;
const config = onlineConfigSchema.parse({
  namespace: "test",
  sourceVersion: "6.0.2",
  targetImage: target,
  applicationRepository: "app",
  sessionAffinity: true,
  sourceDigests: [`sha256:${"a".repeat(64)}`],
  deployment: "web",
  service: "web",
  workloads: [{ kind: "deployments", name: "web", image: target, replicas: 2 }],
  dependencies: [{ kind: "deployments", name: "hub", image: target }],
  ingress: { selector: "app=envoy", cluster: "web" },
});
const targetWorkload = {
  metadata: { name: "web", generation: 2 },
  spec: { replicas: 2, template: { metadata: { labels: {} }, spec: { containers: [{ image: target }] } } },
  status: { observedGeneration: 2, readyReplicas: 2, updatedReplicas: 2 },
};
const platform = () =>
  new KubernetesUpgrade(config, "fixture", "fixture", new URL("https://kubernetes.default.svc"));
const respond = (
  kube: KubernetesUpgrade,
  handler: (path: string, method: string, body?: unknown) => unknown
) => {
  kube.call = vi.fn(
    async <T>(path: string, method = "GET", body?: unknown): Promise<T> => handler(path, method, body) as T
  ) as typeof kube.call;
};

test("a terminating old pod blocks activation even when the primary Deployment is healthy", async () => {
  const kube = platform();
  respond(kube, (path) =>
    path.includes("/deployments/")
      ? targetWorkload
      : {
          items: path.endsWith("/pods")
            ? [
                {
                  metadata: { name: "old", deletionTimestamp: "now" },
                  spec: { containers: [{ image: "app:6.0.2" }] },
                  status: { phase: "Running" },
                },
              ]
            : [],
        }
  );
  await expect(kube.verifyConsumers()).rejects.toThrow("old_consumer_present");
});

test("a suspended old CronJob remains a blocker because it can create another old consumer", async () => {
  const kube = platform();
  respond(kube, (path) => ({
    items: path.endsWith("/cronjobs")
      ? [
          {
            spec: {
              suspend: true,
              jobTemplate: { spec: { template: { spec: { containers: [{ image: "app:6.0.0" }] } } } },
            },
          },
        ]
      : [],
  }));
  await expect(kube.verifyConsumers()).rejects.toThrow("old_consumer_present");
});

test("released embedded-worker processes fail preflight before traffic or schema mutation", async () => {
  const kube = platform();
  respond(kube, (path) =>
    path.includes("/deployments/")
      ? targetWorkload
      : {
          items: [
            {
              metadata: { name: "old" },
              spec: {
                containers: [
                  { name: "web", image: "app:6.0.2", env: [{ name: "BULLMQ_WORKER_ENABLED", value: "1" }] },
                ],
              },
              status: {
                containerStatuses: [
                  { name: "web", imageID: `docker-pullable://app@sha256:${"a".repeat(64)}` },
                ],
              },
            },
          ],
        }
  );
  await expect(kube.preflight()).rejects.toThrow("source_worker_drain_unverified");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "PATCH", expect.anything());
});

test("an unverifiable ingress leaves the serving surge Deployment intact", async () => {
  const kube = platform();
  respond(kube, (path, method) => {
    if (method === "POST") return {};
    if (path.endsWith("/deployments")) return { items: [] };
    if (path.endsWith("/deployments/web-online-surge")) return targetWorkload;
    if (path.endsWith("/services/web"))
      return { metadata: { resourceVersion: "1" }, spec: { selector: { app: "web" } } };
    if (path.includes("endpointslices"))
      return { items: [{ endpoints: [{ targetRef: { uid: "new" }, conditions: { ready: true } }] }] };
    return { items: [] };
  });
  vi.spyOn(kube, "verifyIngressDrain").mockRejectedValue(new Error("unverified drain"));
  await expect(kube.handoff(targetWorkload as Parameters<typeof kube.handoff>[0])).rejects.toThrow(
    "unverified drain"
  );
  expect(kube.call).toHaveBeenCalledWith(
    expect.stringContaining("/deployments"),
    "POST",
    expect.objectContaining({ metadata: expect.objectContaining({ name: "web-online-surge" }) })
  );
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "DELETE", expect.anything());
});

test("an unhealthy pinned dependency blocks activation", async () => {
  const kube = platform();
  respond(kube, (path) => {
    if (path.endsWith("/deployments/web")) return targetWorkload;
    if (path.endsWith("/deployments/hub"))
      return { ...targetWorkload, status: { ...targetWorkload.status, readyReplicas: 0 } };
    return { items: [] };
  });
  await expect(kube.verifyConsumers()).rejects.toThrow("dependency_unhealthy");
});

test("a colliding surge name cannot adopt an unrelated Deployment", async () => {
  const kube = platform();
  respond(kube, (path) => ({
    items: path.endsWith("/deployments")
      ? [{ ...targetWorkload, metadata: { ...targetWorkload.metadata, name: "web-online-surge" } }]
      : [],
  }));
  await expect(kube.handoff(targetWorkload as Parameters<typeof kube.handoff>[0])).rejects.toThrow(
    "surge_identity_changed"
  );
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "PATCH", expect.anything());
});
