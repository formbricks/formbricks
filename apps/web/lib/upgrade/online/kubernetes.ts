import "server-only";
import { readFile } from "node:fs/promises";
import { request } from "node:https";
import { z } from "zod";
import { OnlineUpgradeBlocked } from "./coordinator";

const image = z.string().regex(/^.+@sha256:[a-f0-9]{64}$/);
export const onlineConfigSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9-]+$/),
  sourceVersion: z.enum(["6.0.0", "6.0.1", "6.0.2"]),
  targetImage: image,
  sessionAffinity: z.literal(true),
  deployment: z.string(),
  service: z.string(),
  applicationRepository: z.string().default("ghcr.io/formbricks/formbricks"),
  sourceDigests: z.array(z.string().regex(/^sha256:[a-f0-9]{64}$/)).min(1),
  // Every writer and consumer, including separately deployed workers, is part of this inventory.
  workloads: z
    .array(
      z.object({
        kind: z.enum(["deployments", "statefulsets"]),
        name: z.string(),
        image,
        replicas: z.number().int().min(2),
      })
    )
    .min(1),
  dependencies: z
    .array(z.object({ kind: z.enum(["deployments", "statefulsets"]), name: z.string(), image }))
    .min(1),
  ingress: z.object({
    selector: z.string().min(1),
    proxyResourceNames: z.array(z.string().min(1)).min(1),
    adminPort: z.number().int().positive().default(19000),
    cluster: z.string().min(1),
  }),
  jobDrainTimeoutSeconds: z.number().int().min(10).max(900).default(180),
  timeoutSeconds: z.number().int().min(30).max(3600).default(900),
});
export type OnlineConfig = z.infer<typeof onlineConfigSchema>;
type Metadata = {
  name: string;
  uid: string;
  resourceVersion: string;
  deletionTimestamp?: string;
  labels?: Record<string, string>;
  ownerReferences?: { kind: string; name: string; uid: string }[];
};
type Container = {
  name: string;
  image: string;
  env?: { name: string; value?: string }[];
  readinessProbe?: unknown;
};
type Pod = {
  metadata: Metadata;
  spec: { containers: Container[] };
  status?: {
    phase?: string;
    podIP?: string;
    conditions?: { type: string; status: string }[];
    containerStatuses?: { name: string; imageID: string; ready: boolean }[];
  };
};
type Workload = {
  metadata: Metadata & { generation: number };
  spec: {
    replicas?: number;
    template: {
      metadata: { labels: Record<string, string> };
      spec: { containers: Container[]; terminationGracePeriodSeconds?: number };
    };
  };
  status?: {
    observedGeneration?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
    replicas?: number;
  };
};
type Service = { metadata: Metadata; spec: { selector: Record<string, string> } };
type Slice = {
  endpoints: { addresses?: string[]; targetRef?: { uid: string }; conditions?: { ready?: boolean } }[];
};
const ready = (pod: Pod) =>
  !pod.metadata.deletionTimestamp &&
  pod.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True");

export class KubernetesUpgrade {
  assertLock: () => Promise<void> = async () => {};
  constructor(
    readonly config: OnlineConfig,
    private token: string,
    private ca: string,
    private apiUrl: URL
  ) {}
  static async connect(config: OnlineConfig) {
    const root = "/var/run/secrets/kubernetes.io/serviceaccount/";
    // The well-known in-cluster DNS name avoids taking an arbitrary API destination from configuration.
    return new KubernetesUpgrade(
      config,
      (await readFile(root + "token", "utf8")).trim(),
      await readFile(root + "ca.crt", "utf8"),
      new URL("https://kubernetes.default.svc")
    );
  }
  async call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (method !== "GET") await this.assertLock();
    return new Promise((resolve, reject) => {
      const req = request(
        new URL(path, this.apiUrl),
        {
          method,
          ca: this.ca,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": method === "PATCH" ? "application/merge-patch+json" : "application/json",
          },
          timeout: 15_000,
        },
        (response) => {
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            data += chunk;
            if (data.length > 16 * 1024 * 1024)
              req.destroy(new OnlineUpgradeBlocked("kubernetes_response_too_large"));
          });
          response.on("end", () => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new OnlineUpgradeBlocked("kubernetes_request_failed", true));
              return;
            }
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new OnlineUpgradeBlocked("invalid_kubernetes_response"));
            }
          });
        }
      );
      req.on("timeout", () => req.destroy(new OnlineUpgradeBlocked("kubernetes_timeout", true)));
      req.on("error", reject);
      req.end(body ? JSON.stringify(body) : undefined);
    });
  }
  path(kind: string, name = "") {
    const api = ["deployments", "statefulsets", "replicasets"].includes(kind)
      ? "/apis/apps/v1"
      : ["jobs", "cronjobs"].includes(kind)
        ? "/apis/batch/v1"
        : kind === "horizontalpodautoscalers"
          ? "/apis/autoscaling/v2"
          : kind === "endpointslices"
            ? "/apis/discovery.k8s.io/v1"
            : ["roles", "rolebindings"].includes(kind)
              ? "/apis/rbac.authorization.k8s.io/v1"
              : "/api/v1";
    return `${api}/namespaces/${this.config.namespace}/${kind}${name ? `/${encodeURIComponent(name)}` : ""}`;
  }
  async pods(selector?: string) {
    return (
      await this.call<{ items: Pod[] }>(
        this.path("pods") + (selector ? `?labelSelector=${encodeURIComponent(selector)}` : "")
      )
    ).items;
  }
  private isApplicationImage(value: string) {
    return (
      value.startsWith(`${this.config.applicationRepository}:`) ||
      value.startsWith(`${this.config.applicationRepository}@`)
    );
  }
  private async verifyDependencies() {
    for (const dependency of this.config.dependencies) {
      const workload = await this.call<Workload>(this.path(dependency.kind, dependency.name));
      if (!workload.spec.template.spec.containers.some((c) => c.image === dependency.image))
        throw new OnlineUpgradeBlocked("dependency_image_changed");
      if (
        workload.status?.observedGeneration !== workload.metadata.generation ||
        (workload.status?.readyReplicas ?? 0) < (workload.spec.replicas ?? 1)
      )
        throw new OnlineUpgradeBlocked("dependency_unhealthy", true);
    }
  }
  private oldPods(pods: Pod[]) {
    return pods.filter(
      (p) =>
        !["Succeeded", "Failed"].includes(p.status?.phase ?? "") &&
        p.metadata.labels?.["formbricks.com/upgrade-role"] !== "coordinator" &&
        p.spec.containers.some((c) => this.isApplicationImage(c.image) && c.image !== this.config.targetImage)
    );
  }
  private async verifySourceInventory(pods: Pod[]) {
    const workloads = await Promise.all(
      this.config.workloads.map((w) => this.call<Workload>(this.path(w.kind, w.name)))
    );
    const replicas = await this.call<{ items: { metadata: Metadata }[] }>(this.path("replicasets"));
    const owners = new Set(workloads.map((w) => w.metadata.uid));
    for (const replica of replicas.items) {
      if (replica.metadata.ownerReferences?.some((owner) => owners.has(owner.uid)))
        owners.add(replica.metadata.uid);
    }
    if (
      this.oldPods(pods).some((pod) => !pod.metadata.ownerReferences?.some((owner) => owners.has(owner.uid)))
    )
      throw new OnlineUpgradeBlocked("unmanaged_source_consumer");
    const autoscalers = await this.call<{ items: { spec: { scaleTargetRef: { name: string } } }[] }>(
      this.path("horizontalpodautoscalers")
    );
    if (
      autoscalers.items.some((hpa) =>
        this.config.workloads.some((w) => w.name === hpa.spec.scaleTargetRef.name)
      )
    )
      throw new OnlineUpgradeBlocked("source_autoscaler_present");
  }
  private async verifyServingSurge() {
    const surge = await this.call<Workload>(
      this.path("deployments", `${this.config.deployment}-online-surge`)
    );
    const expected = this.config.workloads.find((w) => w.name === this.config.deployment);
    if (
      !expected ||
      surge.metadata.deletionTimestamp ||
      surge.metadata.labels?.["formbricks.com/upgrade-owner"] !== this.config.deployment ||
      surge.status?.observedGeneration !== surge.metadata.generation ||
      (surge.status.readyReplicas ?? 0) < expected.replicas ||
      !surge.spec.template.spec.containers.some(
        (c) =>
          c.image === this.config.targetImage &&
          c.env?.some((e) => e.name === "BULLMQ_WORKER_ENABLED" && e.value === "1")
      )
    )
      throw new OnlineUpgradeBlocked("serving_surge_workers_required", true);
  }
  async preflight(retirementStarted = false) {
    await this.verifyDependencies();
    for (const expected of this.config.workloads) {
      if (expected.image !== this.config.targetImage)
        throw new OnlineUpgradeBlocked("workload_target_mismatch");
      const workload = await this.call<Workload>(this.path(expected.kind, expected.name));
      if ((workload.spec.replicas ?? 1) < 2 || (workload.status?.readyReplicas ?? 0) < 2) {
        if (!retirementStarted) throw new OnlineUpgradeBlocked("ha_capacity_required", true);
        await this.verifyServingSurge();
      }
    }
    const pods = await this.pods();
    await this.verifySourceInventory(pods);
    await this.verifyBatchConsumers();
    for (const pod of pods) {
      if (["Succeeded", "Failed"].includes(pod.status?.phase ?? "")) continue;
      for (const container of pod.spec.containers.filter((c) => this.isApplicationImage(c.image))) {
        if (pod.metadata.labels?.["formbricks.com/upgrade-role"] === "coordinator") continue;
        const identity = pod.status?.containerStatuses?.find((c) => c.name === container.name)?.imageID ?? "";
        if (container.image === this.config.targetImage) continue;
        if (!this.config.sourceDigests.some((digest) => identity.endsWith(digest)))
          throw new OnlineUpgradeBlocked("unsupported_source_image");
      }
    }
    const gateways = await this.pods(this.config.ingress.selector);
    if (
      !gateways.length ||
      gateways.some(
        (p) =>
          !ready(p) ||
          !this.config.ingress.proxyResourceNames.includes(
            `${p.metadata.name}:${this.config.ingress.adminPort}`
          )
      )
    )
      throw new OnlineUpgradeBlocked("ingress_inventory_unhealthy", true);
  }
  private async verifyBatchConsumers() {
    for (const kind of ["jobs", "cronjobs"]) {
      const batch = await this.call<{
        items: {
          spec: {
            template?: { spec: { containers: Container[] } };
            jobTemplate?: { spec: { template: { spec: { containers: Container[] } } } };
          };
          status?: { conditions?: { type: string; status: string }[] };
        }[];
      }>(this.path(kind));
      for (const job of batch.items) {
        if (
          kind === "jobs" &&
          job.status?.conditions?.some(
            (condition) => ["Complete", "Failed"].includes(condition.type) && condition.status === "True"
          )
        )
          continue;
        const containers =
          job.spec.template?.spec.containers ?? job.spec.jobTemplate?.spec.template.spec.containers ?? [];
        if (containers.some((c) => this.isApplicationImage(c.image) && c.image !== this.config.targetImage))
          throw new OnlineUpgradeBlocked("old_consumer_present", true);
      }
    }
  }
  async verifyConsumers() {
    await this.verifyBatchConsumers();
    for (const expected of this.config.workloads) {
      if (expected.image !== this.config.targetImage)
        throw new OnlineUpgradeBlocked("workload_target_mismatch");
      const workload = await this.call<Workload>(this.path(expected.kind, expected.name));
      if (
        workload.status?.observedGeneration !== workload.metadata.generation ||
        (workload.status?.readyReplicas ?? 0) < expected.replicas ||
        (workload.status?.updatedReplicas ?? 0) < expected.replicas ||
        !workload.spec.template.spec.containers.some((c) => c.image === expected.image)
      )
        throw new OnlineUpgradeBlocked("target_workload_unhealthy", true);
    }
    await this.verifyDependencies();
    for (const pod of await this.pods()) {
      if (["Succeeded", "Failed"].includes(pod.status?.phase ?? "")) continue;
      if (pod.metadata.labels?.["formbricks.com/upgrade-role"] === "coordinator") continue;
      for (const container of pod.spec.containers.filter((c) => this.isApplicationImage(c.image))) {
        // Terminating pods and running Jobs count. Desired Deployment images alone are insufficient.
        if (container.image !== this.config.targetImage || pod.metadata.deletionTimestamp)
          throw new OnlineUpgradeBlocked("old_consumer_present", true);
        if (container.env?.find((e) => e.name === "FORMBRICKS_UPGRADE_MODE")?.value !== "online")
          throw new OnlineUpgradeBlocked("consumer_compatibility_mode_missing");
      }
    }
  }
  async waitForConsumers() {
    await this.wait(async () => {
      try {
        await this.verifyConsumers();
        return true;
      } catch (error) {
        if (error instanceof OnlineUpgradeBlocked && error.retryable) return false;
        throw error;
      }
    });
  }
  async verifySourceConsumersAbsent() {
    await this.verifyServingSurge();
    await this.verifyBatchConsumers();
    if (this.oldPods(await this.pods()).length) throw new OnlineUpgradeBlocked("old_consumer_present", true);
    for (const expected of this.config.workloads) {
      const workload = await this.call<Workload>(this.path(expected.kind, expected.name));
      if (
        (workload.spec.replicas ?? 1) > 0 &&
        workload.spec.template.spec.containers.some(
          (c) => this.isApplicationImage(c.image) && c.image !== this.config.targetImage
        )
      )
        throw new OnlineUpgradeBlocked("source_controller_can_restart", true);
    }
  }
  /** Called only while the shared queue is paused and its active count is zero. */
  async retireSourceConsumers() {
    await this.verifyServingSurge();
    await this.verifyBatchConsumers();
    await this.verifySourceInventory(await this.pods());
    for (const expected of this.config.workloads) {
      const workload = await this.call<Workload>(this.path(expected.kind, expected.name));
      if (
        workload.spec.template.spec.containers.some(
          (c) => this.isApplicationImage(c.image) && c.image !== this.config.targetImage
        )
      ) {
        await this.call(this.path(expected.kind, expected.name), "PATCH", {
          metadata: { resourceVersion: workload.metadata.resourceVersion },
          spec: { replicas: 0 },
        });
      }
    }
    await this.wait(async () => {
      await this.verifyServingSurge();
      await this.verifyBatchConsumers();
      return this.oldPods(await this.pods()).length === 0;
    });
  }
  async wait(check: () => Promise<boolean>) {
    const deadline = Date.now() + this.config.timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      await this.assertLock();
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    throw new OnlineUpgradeBlocked("handoff_pending", true);
  }
  async handoff(template: Workload) {
    const generation = this.config.targetImage.split("@sha256:")[1].slice(0, 32);
    const name = `${this.config.deployment}-online-surge`;
    const before = await this.pods();
    const old = before.filter((p) =>
      p.spec.containers.some((c) => this.isApplicationImage(c.image) && c.image !== this.config.targetImage)
    );
    const surge = {
      ...structuredClone(template),
      metadata: {
        name,
        labels: {
          "formbricks.com/upgrade-role": "surge",
          "formbricks.com/upgrade-owner": this.config.deployment,
        },
      },
    };
    surge.spec.template.metadata.labels["formbricks.com/upgrade-generation"] = generation;
    surge.spec.template.metadata.labels["formbricks.com/upgrade-role"] = "surge";
    surge.spec.template.metadata.labels["formbricks.com/upgrade-owner"] = this.config.deployment;
    const existing = await this.call<{ items: Workload[] }>(this.path("deployments"));
    if (!existing.items.some((item) => item.metadata.name === name))
      await this.call(this.path("deployments"), "POST", surge);
    else {
      const previous = existing.items.find((item) => item.metadata.name === name)!;
      if (
        previous.metadata.labels?.["formbricks.com/upgrade-owner"] !== this.config.deployment ||
        !previous.spec.template.spec.containers.some((c) => c.image === this.config.targetImage)
      )
        throw new OnlineUpgradeBlocked("surge_identity_changed");
    }
    await this.wait(
      async () =>
        (await this.call<Workload>(this.path("deployments", name))).status?.readyReplicas ===
        template.spec.replicas
    );
    const service = await this.call<Service>(this.path("services", this.config.service));
    await this.call(this.path("services", this.config.service), "PATCH", {
      metadata: { resourceVersion: service.metadata.resourceVersion },
      spec: { selector: { ...service.spec.selector, "formbricks.com/upgrade-generation": generation } },
    });
    await this.wait(async () => {
      const slices = await this.call<{ items: Slice[] }>(
        this.path("endpointslices") +
          `?labelSelector=kubernetes.io/service-name%3D${encodeURIComponent(this.config.service)}`
      );
      const endpoints = slices.items.flatMap((slice) => slice.endpoints);
      return (
        endpoints.some((e) => e.conditions?.ready) &&
        !endpoints.some((e) => old.some((p) => p.metadata.uid === e.targetRef?.uid))
      );
    });
    await this.verifyIngressDrain(old);
  }
  async verifyIngressDrain(old: Pod[]) {
    await this.wait(async () => {
      const gateways = await this.pods(this.config.ingress.selector);
      if (!gateways.length || gateways.some((p) => !ready(p))) return false;
      const slices = await this.call<{ items: Slice[] }>(
        this.path("endpointslices") +
          `?labelSelector=kubernetes.io/service-name%3D${encodeURIComponent(this.config.service)}`
      );
      const liveAddresses = new Set(
        slices.items.flatMap((slice) =>
          slice.endpoints
            .filter((endpoint) => endpoint.conditions?.ready)
            .flatMap((endpoint) => endpoint.addresses ?? [])
        )
      );
      if (!liveAddresses.size) return false;
      for (const gateway of gateways) {
        if (
          !this.config.ingress.proxyResourceNames.includes(
            `${gateway.metadata.name}:${this.config.ingress.adminPort}`
          )
        )
          throw new OnlineUpgradeBlocked("ingress_inventory_changed");
        const proxy =
          this.path("pods", `${gateway.metadata.name}:${this.config.ingress.adminPort}`) + "/proxy/";
        const clusters = await this.call<{
          cluster_statuses?: {
            name: string;
            host_statuses?: { address?: { socket_address?: { address?: string } } }[];
          }[];
        }>(proxy + "clusters?format=json");
        const cluster = clusters.cluster_statuses?.find((c) => c.name === this.config.ingress.cluster);
        if (
          !cluster?.host_statuses?.length ||
          cluster.host_statuses.some((h) => {
            const address = h.address?.socket_address?.address;
            // A Service VIP or another proxy can retain connections to withdrawn pods. Only EDS
            // hosts that identify current pod endpoints establish this adapter's drain condition.
            return !address || !liveAddresses.has(address) || old.some((p) => p.status?.podIP === address);
          })
        )
          return false;
        const stats = await this.call<{ stats: { name: string; value: number }[] }>(
          proxy + "stats?format=json"
        );
        const active = stats.stats.find(
          (s) => s.name === `cluster.${this.config.ingress.cluster}.upstream_rq_active`
        );
        // Support requires proving removed-host accounting for the deployed Envoy version.
        // Missing telemetry is never zero; the adapter remains provisional until that rehearsal.
        if (!active || active.value !== 0) return false;
      }
      const after = await this.pods(this.config.ingress.selector);
      return (
        after.length === gateways.length &&
        after.every((p) => gateways.some((g) => g.metadata.uid === p.metadata.uid) && ready(p))
      );
    });
  }
  /** Successful hook deletion collects credentials and configuration along with the finalizer Job. */
  async releaseAccess() {
    const name = `${this.config.deployment}-online`;
    const job = await this.call<{
      metadata: Metadata;
      spec: { template: { spec: { serviceAccountName: string } } };
    }>(this.path("jobs", `${name}-finalize`));
    if (job.spec.template.spec.serviceAccountName !== name)
      throw new OnlineUpgradeBlocked("coordinator_identity_changed");
    for (const kind of ["serviceaccounts", "roles", "rolebindings", "configmaps"]) {
      const resource = await this.call<{ metadata: Metadata }>(this.path(kind, name));
      if (resource.metadata.labels?.["formbricks.com/upgrade-owner"] !== this.config.deployment)
        throw new OnlineUpgradeBlocked("coordinator_identity_changed");
      await this.call(this.path(kind, name), "PATCH", {
        metadata: {
          resourceVersion: resource.metadata.resourceVersion,
          ownerReferences: [
            { apiVersion: "batch/v1", kind: "Job", name: job.metadata.name, uid: job.metadata.uid },
          ],
        },
      });
    }
  }
  async cleanup() {
    await this.verifyConsumers();
    const name = `${this.config.deployment}-online-surge`;
    const workloads = await this.call<{ items: Workload[] }>(this.path("deployments"));
    const existing = workloads.items.find((item) => item.metadata.name === name);
    if (existing) {
      if (
        existing.metadata.labels?.["formbricks.com/upgrade-owner"] !== this.config.deployment ||
        !existing.spec.template.spec.containers.some((c) => c.image === this.config.targetImage)
      )
        throw new OnlineUpgradeBlocked("surge_identity_changed");
      const surge = await this.pods(
        `formbricks.com/upgrade-role=surge,formbricks.com/upgrade-owner=${this.config.deployment}`
      );
      for (const pod of surge) {
        await this.call(this.path("pods", pod.metadata.name), "PATCH", {
          metadata: {
            resourceVersion: pod.metadata.resourceVersion,
            labels: { "formbricks.com/upgrade-generation": "draining" },
          },
        });
      }
      await this.wait(async () => {
        const slices = await this.call<{ items: Slice[] }>(
          this.path("endpointslices") +
            `?labelSelector=kubernetes.io/service-name%3D${encodeURIComponent(this.config.service)}`
        );
        const endpoints = slices.items.flatMap((slice) => slice.endpoints);
        return (
          endpoints.some((endpoint) => endpoint.conditions?.ready) &&
          !endpoints.some((endpoint) => surge.some((pod) => pod.metadata.uid === endpoint.targetRef?.uid))
        );
      });
      await this.verifyIngressDrain(surge);
      await this.verifyConsumers();
      await this.call(this.path("deployments", name), "DELETE", { propagationPolicy: "Foreground" });
    }
  }
}
