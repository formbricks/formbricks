import { describe, expect, it } from "vitest";
import { collectImages, composeDefault, inventory } from "./inventory.mjs";
import { imageRepository, normalizeReport, selectPlatforms } from "./scan.mjs";
import { findings, reconciliation } from "./sync.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const vulnerability = {
  VulnerabilityID: "CVE-2026-1234",
  PkgName: "libssl",
  Severity: "CRITICAL",
  InstalledVersion: "1",
  FixedVersion: "",
};
const result = (image = "example/server:1", vulns = [vulnerability]) => ({
  image,
  sources: ["compose.yml#server"],
  errors: [] as string[],
  expectedPlatforms: ["linux/amd64"],
  scans: [
    { platform: "linux/amd64", digest, report: { Results: [{ Type: "debian", Vulnerabilities: vulns }] } },
  ],
});

describe("image inventory", () => {
  it("reads committed Compose defaults without consulting environment overrides", () => {
    expect(composeDefault("ghcr.io/formbricks/hub${HUB_IMAGE_REF:-:latest}")).toBe(
      "ghcr.io/formbricks/hub:latest"
    );
    expect(composeDefault("${IMAGE:-postgres:17-alpine}")).toBe("postgres:17-alpine");
    expect(() => composeDefault("${IMAGE}")).toThrow("explicit committed default");
  });

  it("includes init containers, operator-created SpiceDB and embedded Envoy configuration", () => {
    const images = collectImages({
      kind: "List",
      items: [
        { spec: { initContainers: [{ image: "postgres:17-alpine" }], containers: [{ image: "app:1" }] } },
        { kind: "SpiceDBCluster", spec: { version: "v1.52.0" } },
        {
          kind: "ConfigMap",
          data: { "envoy-gateway.yaml": "provider:\n  container:\n    image: envoyproxy/ratelimit:123\n" },
        },
      ],
    });
    expect([...images]).toEqual([
      "postgres:17-alpine",
      "app:1",
      "authzed/spicedb:v1.52.0",
      "envoyproxy/ratelimit:123",
    ]);
  });

  it("renders both default and optional profiles and includes all Compose services", () => {
    const profiles: string[][] = [];
    const entries = inventory((_command: string, args: string[]) => {
      profiles.push(args);
      return "kind: Pod\nspec:\n  containers:\n  - image: test/optional@" + digest + "\n";
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[1]).toContain("scripts/container-security/profiles.yaml");
    expect(entries.some((e: { image: string }) => e.image === "test/optional@" + digest)).toBe(true);
    for (const file of ["docker/docker-compose.yml", "docker-compose.dev.yml"]) {
      expect(
        entries.some((e: { sources: string[] }) => e.sources.some((source) => source.startsWith(`${file}#`)))
      ).toBe(true);
    }
  });
});

describe("immutable image selection", () => {
  it("accepts a valid no-packages report but rejects truncated output", () => {
    expect(
      normalizeReport({ SchemaVersion: 2, ArtifactType: "container_image", Metadata: { ImageID: digest } })
        .Results
    ).toEqual([]);
    expect(() => normalizeReport({ SchemaVersion: 2 })).toThrow("Incomplete");
  });
  it("normalizes Docker Hub references and keeps registry ports", () => {
    expect(imageRepository("postgres:17-alpine")).toBe("docker.io/library/postgres");
    expect(imageRepository("pgvector/pgvector@" + digest)).toBe("docker.io/pgvector/pgvector");
    expect(imageRepository("registry.example:5000/app:1@" + digest)).toBe("registry.example:5000/app");
  });

  it("excludes attestation manifests and does not invent an unsupported architecture", () => {
    const entry = { digest, platform: { os: "linux", architecture: "amd64" } };
    expect(
      selectPlatforms(
        { manifests: [entry, { digest, platform: { os: "unknown", architecture: "unknown" } }] },
        null
      )
    ).toEqual([entry]);
    expect(() => selectPlatforms({ digest: "latest" }, { os: "linux", architecture: "amd64" })).toThrow(
      "invalid digest"
    );
    expect(() => selectPlatforms({ manifests: [] }, null)).toThrow("no supported");
  });
});

describe("Linear reconciliation", () => {
  const repo = "formbricks/formbricks";
  const prefix = [...findings(repo, [result()]).keys()][0];
  const existing = [{ id: "issue", title: `${prefix} vulnerability`, state: { type: "started" } }];
  const expected = [{ image: "example/server:1" }];

  it("deduplicates a CVE across versions and architectures and retains unfixed critical findings", () => {
    const other = result("example/server:2");
    other.scans[0].platform = "linux/arm64";
    const grouped = findings(repo, [result(), other]);
    expect(grouped.size).toBe(1);
    expect(grouped.get(prefix)?.priority).toBe(1);
    expect(grouped.get(prefix)?.occurrences.size).toBe(2);
    expect([...grouped.get(prefix)!.occurrences][0]).toContain("fix: not available");
  });

  it("raises a high-priority finding when an image cannot be scanned", () => {
    const failures = findings(repo, [{ ...result(), scans: [], errors: ["manifest not found"] }]);
    expect(failures.size).toBe(1);
    expect([...failures.values()][0].priority).toBe(2);
    expect([...failures.values()][0].title).toContain("Cannot scan");
  });

  it("only closes a disappeared finding after a complete successful inventory", () => {
    const plan = reconciliation(repo, expected, [result("example/server:1", [])], existing);
    expect(plan.complete).toBe(true);
    expect(plan.close).toEqual(existing);
  });

  it("does not close on missing artifacts, failed scans, empty inventories or duplicated artifacts", () => {
    const failed = { ...result(), errors: ["registry unavailable"] };
    for (const results of [
      [],
      [failed],
      [result(), result()],
      [{ ...result(), expectedPlatforms: ["linux/amd64", "linux/arm64"] }],
      [{ ...result(), scans: [] }],
    ]) {
      expect(reconciliation(repo, expected, results, existing).close).toEqual([]);
      expect(reconciliation(repo, expected, results, existing).complete).toBe(false);
    }
    expect(reconciliation(repo, [], [], existing).complete).toBe(false);
  });

  it("keeps a ticket open when severity drops but the vulnerability is still present", () => {
    const lower = result("example/server:1", [{ ...vulnerability, Severity: "MEDIUM" }]);
    expect(reconciliation(repo, expected, [lower], existing).close).toEqual([]);
  });
});
