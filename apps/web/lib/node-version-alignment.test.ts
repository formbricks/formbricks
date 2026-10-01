import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Keeps every place that picks a Node.js version on the same major as `.nvmrc` (see ENG-1676,
// ENG-2878). `.nvmrc` is the single source of truth; the rest drifted from it once already:
//
//   package.json engines            — the range local installs are checked against.
//   apps/web/Dockerfile             — the production runtime.
//   .devcontainer/devcontainer.json — Codespaces / VS Code dev containers.
//   .github/workflows/*.yml         — every actions/setup-node step must read `.nvmrc` rather than
//                                     hard-code a version.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const read = (...segments: string[]): string => fs.readFileSync(path.join(repoRoot, ...segments), "utf-8");

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
    const { image } = JSON.parse(read(".devcontainer", "devcontainer.json")) as { image?: string };
    // mcr.microsoft.com/devcontainers/javascript-node:<image major>-<node major>-<distro>
    const devcontainerNode = /\/javascript-node:\d+-(\d+)-[a-z]+$/.exec(image ?? "")?.[1];

    expect(devcontainerNode, `unexpected devcontainer image "${image}"`).toBe(nodeMajor);
  });

  test("every setup-node step reads .nvmrc", () => {
    const workflowsDir = path.join(repoRoot, ".github", "workflows");
    const offenders: string[] = [];

    for (const file of fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name))) {
      // Split into steps on "- name:"/"- uses:" boundaries; a setup-node step must carry its own
      // node-version-file and never a literal node-version.
      const steps = read(".github", "workflows", file).split(/^\s*- (?=name:|uses:)/m);
      for (const step of steps) {
        if (!/uses:\s*actions\/setup-node@/.test(step)) continue;
        if (!/node-version-file:\s*["']?\.nvmrc["']?\s*$/m.test(step) || /^\s*node-version:/m.test(step)) {
          offenders.push(file);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
