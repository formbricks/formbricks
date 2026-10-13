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
  ingress: { selector: "app=envoy", cluster: "web", proxyResourceNames: ["envoy:19000"] },
});
const targetWorkload = {
  metadata: { name: "web", uid: "workload", generation: 2 },
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

test("released embedded workers may prepare when their controller is inventoried", async () => {
  const kube = platform();
  respond(kube, (path) => {
    if (path.includes("/deployments/")) return targetWorkload;
    if (path.includes("labelSelector"))
      return {
        items: [{ metadata: { name: "envoy" }, status: { conditions: [{ type: "Ready", status: "True" }] } }],
      };
    if (path.endsWith("/pods"))
      return {
        items: [
          {
            metadata: { name: "old", ownerReferences: [{ uid: "workload" }] },
            spec: {
              containers: [
                { name: "web", image: "app:6.0.2", env: [{ name: "BULLMQ_WORKER_ENABLED", value: "1" }] },
              ],
            },
            status: { containerStatuses: [{ name: "web", imageID: `app@sha256:${"a".repeat(64)}` }] },
          },
        ],
      };
    return { items: [] };
  });
  await expect(kube.preflight()).resolves.toBeUndefined();
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

test("drained source controllers scale to zero only while healthy target surge workers remain", async () => {
  const kube = platform();
  let replicas = 2;
  let podChecks = 0;
  const source = {
    ...targetWorkload,
    spec: {
      ...targetWorkload.spec,
      template: { metadata: { labels: {} }, spec: { containers: [{ image: "app:6.0.2" }] } },
    },
  };
  const surge = {
    ...targetWorkload,
    metadata: { ...targetWorkload.metadata, labels: { "formbricks.com/upgrade-owner": "web" } },
    spec: {
      ...targetWorkload.spec,
      template: {
        metadata: { labels: {} },
        spec: { containers: [{ image: target, env: [{ name: "BULLMQ_WORKER_ENABLED", value: "1" }] }] },
      },
    },
  };
  const oldPod = {
    metadata: { name: "old", ownerReferences: [{ uid: "workload" }] },
    spec: { containers: [{ image: "app:6.0.2" }] },
  };
  respond(kube, (path, method, body) => {
    if (path.endsWith("/deployments/web-online-surge")) return surge;
    if (path.endsWith("/deployments/web")) {
      if (method === "PATCH") {
        expect(body).toMatchObject({ spec: { replicas: 0 } });
        replicas = 0;
      }
      return { ...source, spec: { ...source.spec, replicas } };
    }
    if (path.endsWith("/pods")) return { items: replicas || podChecks++ === 0 ? [oldPod] : [] };
    return { items: [] };
  });
  kube.wait = async (check) => {
    expect(await check()).toBe(false);
    expect(await check()).toBe(true);
  };
  await kube.retireSourceConsumers();
  await kube.verifySourceConsumersAbsent();
  expect(replicas).toBe(0);
  expect(kube.call).toHaveBeenCalledWith(
    expect.stringContaining("/deployments/web"),
    "PATCH",
    expect.objectContaining({ spec: { replicas: 0 } })
  );
});

test("an unmanaged source pod prevents retiring any configured workload", async () => {
  const kube = platform();
  respond(kube, (path) => {
    if (path.endsWith("/deployments/web-online-surge"))
      return {
        ...targetWorkload,
        metadata: { ...targetWorkload.metadata, labels: { "formbricks.com/upgrade-owner": "web" } },
        spec: {
          ...targetWorkload.spec,
          template: {
            metadata: { labels: {} },
            spec: { containers: [{ image: target, env: [{ name: "BULLMQ_WORKER_ENABLED", value: "1" }] }] },
          },
        },
      };
    if (path.endsWith("/deployments/web")) return targetWorkload;
    return {
      items: path.endsWith("/pods")
        ? [{ metadata: { name: "unmanaged" }, spec: { containers: [{ image: "app:6.0.2" }] } }]
        : [],
    };
  });
  await expect(kube.retireSourceConsumers()).rejects.toThrow("unmanaged_source_consumer");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "PATCH", expect.anything());
});

test("an HPA that can recreate source workers blocks preflight", async () => {
  const kube = platform();
  respond(kube, (path) => {
    if (path.includes("/deployments/")) return targetWorkload;
    if (path.endsWith("/horizontalpodautoscalers"))
      return { items: [{ spec: { scaleTargetRef: { name: "web" } } }] };
    return { items: [] };
  });
  await expect(kube.preflight()).rejects.toThrow("source_autoscaler_present");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "PATCH", expect.anything());
});

test.each([
  { host: "10.0.0.2", active: 0, drained: true },
  { host: "10.96.0.10", active: 0, drained: false },
  { host: "10.0.0.1", active: 0, drained: false },
  { host: "10.0.0.2", active: 1, drained: false },
  { host: "10.0.0.2", active: undefined, drained: false },
])(
  "drain requires current pod endpoints and known zero active requests: $host / $active",
  async ({ host, active, drained }) => {
    const kube = platform();
    const gateway = {
      metadata: { name: "envoy", uid: "envoy" },
      status: { conditions: [{ type: "Ready", status: "True" }] },
    };
    respond(kube, (path) => {
      if (path.includes("endpointslices"))
        return { items: [{ endpoints: [{ addresses: ["10.0.0.2"], conditions: { ready: true } }] }] };
      if (path.endsWith("clusters?format=json"))
        return {
          cluster_statuses: [
            { name: "web", host_statuses: [{ address: { socket_address: { address: host } } }] },
          ],
        };
      if (path.endsWith("stats?format=json"))
        return {
          stats: active === undefined ? [] : [{ name: "cluster.web.upstream_rq_active", value: active }],
        };
      return { items: [gateway] };
    });
    kube.wait = async (check) => {
      expect(await check()).toBe(drained);
    };
    await kube.verifyIngressDrain([
      {
        metadata: { name: "old", uid: "old", resourceVersion: "1" },
        spec: { containers: [] },
        status: { podIP: "10.0.0.1" },
      },
    ]);
  }
);

test("a failed source Job attempt still blocks while the Job can retry", async () => {
  const kube = platform();
  respond(kube, (path) => ({
    items: path.endsWith("/jobs")
      ? [
          {
            spec: { template: { spec: { containers: [{ image: "app:6.0.2" }] } } },
            status: { failed: 1 },
          },
        ]
      : [],
  }));
  await expect(kube.verifyConsumers()).rejects.toThrow("old_consumer_present");
});

const servingSurge = {
  ...targetWorkload,
  metadata: {
    ...targetWorkload.metadata,
    name: "web-online-surge",
    labels: { "formbricks.com/upgrade-owner": "web" },
  },
};
const surgePod = {
  metadata: { name: "surge-pod", uid: "surge-pod", resourceVersion: "7" },
  spec: { containers: [{ name: "web", image: target }] },
};

test("cleanup withdraws surge endpoints, verifies ingress and primary health, then deletes surge", async () => {
  const kube = platform();
  const events: string[] = [];
  vi.spyOn(kube, "verifyConsumers").mockImplementation(() => {
    events.push("healthy-primary");
    return Promise.resolve();
  });
  vi.spyOn(kube, "verifyIngressDrain").mockImplementation((pods) => {
    expect(pods).toEqual([surgePod]);
    events.push("ingress-drained");
    return Promise.resolve();
  });
  respond(kube, (path, method, body) => {
    if (method === "PATCH") {
      expect(body).toMatchObject({
        metadata: { resourceVersion: "7", labels: { "formbricks.com/upgrade-generation": "draining" } },
      });
      events.push("withdraw-surge");
      return {};
    }
    if (method === "DELETE") {
      expect(body).toEqual({ propagationPolicy: "Foreground" });
      events.push("delete-surge");
      return {};
    }
    if (path.endsWith("/deployments")) return { items: [servingSurge] };
    if (path.includes("/pods?")) return { items: [surgePod] };
    if (path.includes("endpointslices")) {
      events.push("endpoints-withdrawn");
      return { items: [{ endpoints: [{ targetRef: { uid: "primary" }, conditions: { ready: true } }] }] };
    }
    throw new Error(`Unexpected Kubernetes call: ${path}`);
  });
  await kube.cleanup();
  expect(events).toEqual([
    "healthy-primary",
    "withdraw-surge",
    "endpoints-withdrawn",
    "ingress-drained",
    "healthy-primary",
    "delete-surge",
  ]);
});

test("cleanup preserves surge if the ingress cannot prove it has drained", async () => {
  const kube = platform();
  vi.spyOn(kube, "verifyConsumers").mockResolvedValue(undefined);
  vi.spyOn(kube, "verifyIngressDrain").mockRejectedValue(new Error("drain unverified"));
  respond(kube, (path, method) => {
    if (method === "PATCH") return {};
    if (path.endsWith("/deployments")) return { items: [servingSurge] };
    if (path.includes("/pods?")) return { items: [surgePod] };
    return { items: [{ endpoints: [{ targetRef: { uid: "primary" }, conditions: { ready: true } }] }] };
  });
  await expect(kube.cleanup()).rejects.toThrow("drain unverified");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "DELETE", expect.anything());
});

test("cleanup is idempotent after surge removal and refuses a colliding workload", async () => {
  const kube = platform();
  vi.spyOn(kube, "verifyConsumers").mockResolvedValue(undefined);
  respond(kube, () => ({ items: [] }));
  await kube.cleanup();
  expect(kube.call).toHaveBeenCalledOnce();
  respond(kube, () => ({ items: [{ ...servingSurge, metadata: { ...servingSurge.metadata, labels: {} } }] }));
  await expect(kube.cleanup()).rejects.toThrow("surge_identity_changed");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "DELETE", expect.anything());
});

test("temporary access is collected with the successful finalizer Job", async () => {
  const kube = platform();
  respond(kube, (path) =>
    path.includes("/jobs/")
      ? {
          metadata: { name: "web-online-finalize", uid: "finalizer-uid" },
          spec: { template: { spec: { serviceAccountName: "web-online" } } },
        }
      : { metadata: { resourceVersion: "7", labels: { "formbricks.com/upgrade-owner": "web" } } }
  );
  await kube.releaseAccess();
  for (const kind of ["serviceaccounts", "roles", "rolebindings", "configmaps"]) {
    expect(kube.call).toHaveBeenCalledWith(kube.path(kind, "web-online"), "PATCH", {
      metadata: {
        resourceVersion: "7",
        ownerReferences: [
          { apiVersion: "batch/v1", kind: "Job", name: "web-online-finalize", uid: "finalizer-uid" },
        ],
      },
    });
  }
});

test("a foreign coordinator identity cannot adopt access resources", async () => {
  const kube = platform();
  respond(kube, () => ({
    metadata: { uid: "foreign" },
    spec: { template: { spec: { serviceAccountName: "another-account" } } },
  }));
  await expect(kube.releaseAccess()).rejects.toThrow("coordinator_identity_changed");
  expect(kube.call).not.toHaveBeenCalledWith(expect.anything(), "PATCH", expect.anything());
});

test("a replacement ingress outside the proxy allowlist blocks drain", async () => {
  const kube = platform();
  respond(kube, (path) =>
    path.includes("endpointslices")
      ? {
          items: [{ endpoints: [{ addresses: ["10.0.0.2"], conditions: { ready: true } }] }],
        }
      : {
          items: [
            {
              metadata: { name: "other-envoy" },
              status: { conditions: [{ type: "Ready", status: "True" }] },
            },
          ],
        }
  );
  kube.wait = async (check) => {
    await check();
  };
  await expect(kube.verifyIngressDrain([])).rejects.toThrow("ingress_inventory_changed");
});
