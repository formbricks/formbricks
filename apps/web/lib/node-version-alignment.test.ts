import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import * as yaml from "yaml";

// Keeps every place that picks a Node.js version on the same major as `.nvmrc` (see ENG-1676,
// ENG-2878). `.nvmrc` is the single source of truth; the rest drifted from it once already:
//
//   package.json engines            — the range local installs are checked against.
//   apps/web/Dockerfile             — the production runtime.
//   .devcontainer/devcontainer.json — Codespaces / VS Code dev containers.
//   .github/workflows/*.yml,
//   .github/actions/*/action.yml    — every actions/setup-node step must read `.nvmrc` rather than
//                                     hard-code a version.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const read = (...segments: string[]): string => fs.readFileSync(path.join(repoRoot, ...segments), "utf-8");

// devcontainer.json is JSONC (comments and trailing commas are allowed), so JSON.parse would fail on a
// valid file with a parse error instead of reporting drift. TypeScript's tsconfig reader handles JSONC.
const readJsonc = (...segments: string[]): unknown => {
  const { config, error } = ts.parseConfigFileTextToJson(segments.join("/"), read(...segments));
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
  return config;
};

const listYaml = (...segments: string[]): string[][] => {
  const dir = path.join(repoRoot, ...segments);
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((name) => /\.ya?ml$/.test(name))
        .map((name) => [...segments, name])
    : [];
};

interface WorkflowStep {
  name?: string;
  uses?: unknown;
  with?: Record<string, unknown>;
}

interface WorkflowFile {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
  runs?: { steps?: WorkflowStep[] };
}

const nvmrcVersion = read(".nvmrc").trim();
const nodeMajor = /^v?(\d+)\.\d+\.\d+$/.exec(nvmrcVersion)?.[1];

describe("Node.js version alignment", () => {
  test(".nvmrc pins an exact version", () => {
    expect(nodeMajor, `.nvmrc must hold an exact x.y.z version, got "${nvmrcVersion}"`).toBeDefined();
  });

  test("root engines admit only the .nvmrc major", () => {
    const { engines } = JSON.parse(read("package.json")) as { engines?: { node?: string } };

    expect(engines?.node).toBe(`>=${nodeMajor}.0.0 <${Number(nodeMajor) + 1}`);
  });

  test("the production image runs the .nvmrc major", () => {
    const baseImage = /^FROM\s+node:(\d+)[-@\s]/m.exec(read("apps", "web", "Dockerfile"))?.[1];

    expect(baseImage).toBe(nodeMajor);
  });

  test("the devcontainer image runs the .nvmrc major", () => {
    const { image } = readJsonc(".devcontainer", "devcontainer.json") as { image?: string };
    // mcr.microsoft.com/devcontainers/javascript-node:<image major>-<node major>-<distro>
    const devcontainerNode = /\/javascript-node:\d+-(\d+)-[a-z]+$/.exec(image ?? "")?.[1];

    expect(devcontainerNode, `unexpected devcontainer image "${image}"`).toBe(nodeMajor);
  });

  test("every setup-node step reads .nvmrc", () => {
    const actionsDir = path.join(repoRoot, ".github", "actions");
    const files = [
      ...listYaml(".github", "workflows"),
      ...fs
        .readdirSync(actionsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => listYaml(".github", "actions", entry.name)),
    ];
    const offenders: string[] = [];
    let setupNodeSteps = 0;

    for (const file of files) {
      // Workflows keep their steps under jobs.<id>.steps, composite actions under runs.steps. Parsing
      // rather than pattern-matching the text also catches quoted scalars and flow-style mappings.
      const doc = (yaml.parse(read(...file)) ?? {}) as WorkflowFile;
      const steps = [
        ...Object.values(doc.jobs ?? {}).flatMap((job) => job.steps ?? []),
        ...(doc.runs?.steps ?? []),
      ];

      for (const step of steps) {
        if (typeof step.uses !== "string" || !step.uses.startsWith("actions/setup-node@")) continue;
        setupNodeSteps += 1;
        if (step.with?.["node-version-file"] !== ".nvmrc" || step.with?.["node-version"] !== undefined) {
          offenders.push(`${file.join("/")} (${step.name ?? step.uses})`);
        }
      }
    }

    // Guards against the parse silently finding nothing (a moved directory, a renamed key).
    expect(setupNodeSteps).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
