import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectImages, composeDefault, inventory } from "./inventory.mjs";
import { imageRepository, normalizeReport, selectPlatforms } from "./scan.mjs";
import { description, findings, reconciliation } from "./sync.mjs";

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
  const existing = [
    {
      id: "issue",
      title: `${prefix} Critical/high vulnerabilities in docker.io/example/server`,
      state: { type: "started" },
    },
  ];
  const expected = [{ image: "example/server:1" }];

  it("groups every CVE, tag and architecture of an image repository into one ticket", () => {
    const other = result("example/server:2", [
      vulnerability,
      { ...vulnerability, VulnerabilityID: "CVE-2026-9999", PkgName: "zlib", Severity: "HIGH" },
    ]);
    other.scans[0].platform = "linux/arm64";
    const grouped = findings(repo, [result(), other, result("example/other:1")]);
    expect(grouped.size).toBe(2);
    const server = grouped.get(prefix)!;
    expect(server.title).toBe(`${prefix} Critical/high vulnerabilities in docker.io/example/server`);
    expect(server.priority).toBe(2);
    expect([...server.occurrences].sort()).toEqual([
      "- CRITICAL CVE-2026-1234 in libssl (debian): example/server:1: 1, fix: not available (linux/amd64); example/server:2: 1, fix: not available (linux/arm64)",
      "- HIGH CVE-2026-9999 in zlib (debian): example/server:2: 1, fix: not available (linux/arm64)",
    ]);
    expect(server.scans.size).toBe(2);
  });

  it("ignores kernel headers and only opens tickets for critical/high findings", () => {
    const headers = { ...vulnerability, PkgName: "linux-libc-dev" };
    const medium = { ...vulnerability, VulnerabilityID: "CVE-2026-5555", Severity: "MEDIUM" };
    expect(findings(repo, [result("example/server:1", [headers, medium])]).size).toBe(0);
    const [ticket] = findings(repo, [result("example/server:1", [vulnerability, headers, medium])]).values();
    const body = description(repo, ticket);
    expect(body).not.toContain("linux-libc-dev");
    expect(body).toContain("Image repository: `docker.io/example/server`");
    expect(body).toContain("Not listed: 1 medium/low/unrated findings.");
    expect(body.indexOf("CVE-2026-1234")).toBeLessThan(body.indexOf("Not listed"));
    expect(body).toContain(`- example/server:1 (linux/amd64, ${digest}). Sources: compose.yml#server`);
  });

  it("supersedes untouched legacy per-CVE tickets once their repository scans completely", () => {
    const legacy = {
      id: "legacy",
      title: "[Container formbricks/formbricks 0123456789abcdef01234567] CVE-2026-1234 in libssl",
      description: "Image repository: `docker.io/example/server`",
      state: { type: "triage" },
    };
    const assessed = { ...legacy, id: "assessed", state: { type: "unstarted" } };
    const edited = { ...existing[0], id: "edited", title: `${existing[0].title} (bumped upstream)` };
    const plan = reconciliation(repo, expected, [result("example/server:1", [])], [legacy, assessed, edited]);
    expect(plan.supersede).toEqual([legacy]);
    expect(plan.close).toEqual([edited]);
    const failed = { ...result(), errors: ["registry unavailable"] };
    for (const [inventory, results] of [
      [expected, [failed]],
      [expected, [{ ...result(), expectedPlatforms: ["linux/amd64", "linux/arm64"] }]],
      [[], []],
    ] as const) {
      expect(reconciliation(repo, [...inventory], [...results], [legacy]).supersede).toEqual([]);
    }
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

  it("keeps an image ticket open while any critical/high finding remains, then resolves it", () => {
    const remaining = { ...vulnerability, VulnerabilityID: "CVE-2026-7777", Severity: "HIGH" };
    expect(reconciliation(repo, expected, [result("example/server:1", [remaining])], existing).close).toEqual(
      []
    );
    const lower = result("example/server:1", [{ ...vulnerability, Severity: "MEDIUM" }]);
    expect(reconciliation(repo, expected, [lower], existing).close).toEqual(existing);
  });

  it("closes a healthy repository's ticket despite an unrelated failure, but retains unscoped tickets", () => {
    const broken = { ...result("bitnami/redis:missing", []), errors: ["manifest not found"], scans: [] };
    const scoped = {
      ...existing[0],
      description: "Image repository: `docker.io/example/server`",
    };
    const unscoped = { ...existing[0], id: "legacy" };
    const malformed = { ...existing[0], id: "edited", description: "Image repository: " };
    const plan = reconciliation(
      repo,
      [...expected, { image: broken.image }],
      [result("example/server:1", []), broken],
      [scoped, unscoped, malformed]
    );
    expect(plan.complete).toBe(false);
    expect(plan.close).toEqual([scoped]);
    expect([...plan.current.values()][0]).toMatchObject({ scope: { image: broken.image }, priority: 2 });
  });

  it("requires every tag and architecture of a vulnerability's repository to scan successfully", () => {
    const issue = {
      ...existing[0],
      description: "Image repository: `docker.io/example/server`",
    };
    const healthy = result("example/server:1", []);
    const other = result("example/server:2", []);
    const inventory = [...expected, { image: other.image }];
    for (const partial of [
      [healthy],
      [healthy, { ...other, errors: ["registry unavailable"] }],
      [healthy, { ...other, expectedPlatforms: ["linux/amd64", "linux/arm64"] }],
      [healthy, other, other],
    ]) {
      expect(reconciliation(repo, inventory, partial, [issue]).close).toEqual([]);
    }
    expect(reconciliation(repo, inventory, [healthy, other], [issue]).close).toEqual([issue]);
  });

  it("closes recovered scan failures and removed dependencies without requiring unrelated scans", () => {
    const broken = { ...result("bitnami/redis:missing", []), errors: ["manifest not found"], scans: [] };
    const recovered = {
      id: "recovered",
      title: "[Container formbricks/formbricks old-error] Cannot scan example/server:1",
      description: "Scan image: `example/server:1`",
      state: { type: "started" },
    };
    const removed = {
      ...existing[0],
      description: "Image repository: `docker.io/removed/server`",
    };
    const inventory = [...expected, { image: broken.image }];
    expect(
      reconciliation(repo, inventory, [result("example/server:1", []), broken], [recovered, removed]).close
    ).toEqual([recovered, removed]);
    expect(reconciliation(repo, [], [], [recovered, removed]).close).toEqual([]);
  });

  it("reports missing scan artifacts when the downloaded reports directory does not exist", () => {
    const directory = mkdtempSync(join(tmpdir(), "container-sync-"));
    try {
      const inventoryPath = join(directory, "inventory.json");
      writeFileSync(
        inventoryPath,
        JSON.stringify([{ image: "example/server:1", sources: ["compose#server"] }])
      );
      const sync = spawnSync(
        process.execPath,
        [
          "scripts/container-security/sync.mjs",
          inventoryPath,
          join(directory, "missing-reports"),
          "--dry-run",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, GITHUB_REPOSITORY: repo, LINEAR_API_KEY: "", LINEAR_ACCESS_KEY: "" },
        }
      );
      expect(sync.status).toBe(1);
      expect(sync.stdout).toContain("create [Container formbricks/formbricks");
      expect(sync.stdout).toContain("Cannot scan example/server:1");
      expect(sync.stderr).toContain("Incomplete image scan");
      expect(sync.stderr).not.toContain("ENOENT");
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
