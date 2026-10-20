import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  LINEAR_TEAM_ID,
  LINEAR_TRIAGE_STATE_ID,
  createIssue,
  linearRequest,
  resolveDoneStateId,
  setIssueState,
} from "../dependabot-to-linear.mjs";
import { imageRepository } from "./scan.mjs";

export function findings(repo, results) {
  const groups = new Map();
  for (const result of results) {
    if (result.errors.length) {
      const key = createHash("sha256").update(`scan-error:${result.image}`).digest("hex").slice(0, 24);
      const prefix = `[Container ${repo} ${key}]`;
      groups.set(prefix, {
        title: `${prefix} Cannot scan ${result.image}`,
        priority: 2,
        scope: { image: result.image },
        occurrences: new Set(
          result.errors.map((error) => `- Scan failure: ${error}. Sources: ${result.sources.join(", ")}`)
        ),
      });
    }
    for (const scan of result.scans) {
      for (const target of scan.report.Results) {
        for (const vuln of target.Vulnerabilities ?? []) {
          const image = imageRepository(result.image);
          const key = createHash("sha256")
            .update(JSON.stringify([image, target.Type, vuln.PkgName, vuln.VulnerabilityID]))
            .digest("hex")
            .slice(0, 24);
          const prefix = `[Container ${repo} ${key}]`;
          const severity = vuln.Severity?.toUpperCase();
          const priority = severity === "CRITICAL" ? 1 : severity === "HIGH" ? 2 : 3;
          if (!groups.has(prefix))
            groups.set(prefix, {
              title: `${prefix} ${vuln.VulnerabilityID} in ${vuln.PkgName}`,
              priority,
              scope: { repository: image },
              occurrences: new Set(),
            });
          const group = groups.get(prefix);
          group.priority = Math.min(group.priority, priority);
          group.occurrences.add(
            `- ${result.image} (${scan.platform}, ${scan.digest}): ${vuln.PkgName} ${vuln.InstalledVersion}; ${severity}; fix: ${vuln.FixedVersion || "not available"}. Sources: ${result.sources.join(", ")}`
          );
        }
      }
    }
  }
  return groups;
}

export function reconciliation(repo, inventory, results, existing) {
  const validInventory =
    inventory.length > 0 && new Set(inventory.map((e) => e.image)).size === inventory.length;
  // A repository-level CVE can occur in several tags; every current tag and architecture must succeed.
  const completeImages = new Set(
    inventory
      .filter((entry) => {
        const matches = results.filter((r) => r.image === entry.image);
        if (matches.length !== 1) return false;
        const [r] = matches;
        return (
          !r.errors.length &&
          r.expectedPlatforms?.length > 0 &&
          r.scans.length === r.expectedPlatforms.length &&
          r.expectedPlatforms.every((platform) => r.scans.some((scan) => scan.platform === platform))
        );
      })
      .map((entry) => entry.image)
  );
  const complete =
    validInventory && results.length === inventory.length && completeImages.size === inventory.length;
  const canClose = (issue) => {
    if (!validInventory) return false;
    const repository = issue.description?.match(/^Image repository: `([^`\r\n]+)`$/m)?.[1];
    if (repository) {
      return inventory
        .filter((entry) => imageRepository(entry.image) === repository)
        .every((entry) => completeImages.has(entry.image));
    }
    const image = issue.description?.match(/^Scan image: `([^`\r\n]+)`$/m)?.[1];
    if (image) return !inventory.some((entry) => entry.image === image) || completeImages.has(image);
    // Old or edited tickets without scope metadata need a complete scan of the entire inventory.
    return complete;
  };
  const current = findings(repo, results);
  const activePrefixes = new Set(current.keys());
  const prefixOf = (title) => title.slice(0, title.indexOf("]") + 1);
  return {
    complete,
    current,
    close: existing.filter(
      (issue) =>
        !activePrefixes.has(prefixOf(issue.title)) &&
        !["completed", "canceled"].includes(issue.state.type) &&
        canClose(issue)
    ),
  };
}

async function listIssues(apiKey, prefix) {
  const issues = [];
  let after = null;
  do {
    const data = await linearRequest(
      apiKey,
      `query ContainerIssues($teamId: ID!, $prefix: String!, $after: String) {
      issues(filter: { team: { id: { eq: $teamId } }, title: { startsWith: $prefix } }, first: 100, after: $after) {
        nodes { id title description priority state { type } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
      { teamId: LINEAR_TEAM_ID, prefix, after }
    );
    issues.push(...data.issues.nodes);
    after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null;
  } while (after);
  return issues;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (
    !dryRun &&
    (process.env.GITHUB_REF !== "refs/heads/main" ||
      !["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))
  )
    throw new Error("Container ticket writes are only allowed from main's scheduled/manual workflow");
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is required");
  const apiKey = process.env.LINEAR_API_KEY || process.env.LINEAR_ACCESS_KEY;
  if (!apiKey && !dryRun) throw new Error("LINEAR_API_KEY is required");
  const inventory = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const directory = process.argv[3];
  const results = (existsSync(directory) ? readdirSync(directory, { recursive: true }) : [])
    .filter((name) => name.endsWith("/result.json") || name === "result.json")
    .map((name) => JSON.parse(readFileSync(`${directory}/${name}`, "utf8")));
  for (const entry of inventory) {
    if (!results.some((result) => result.image === entry.image)) {
      results.push({
        ...entry,
        scans: [],
        errors: ["No scan artifact: inspect the failed or timed-out matrix job"],
      });
    }
  }
  const existing = apiKey ? await listIssues(apiKey, `[Container ${repo} `) : [];
  const plan = reconciliation(repo, inventory, results, existing);
  for (const [prefix, finding] of plan.current) {
    const issue = existing.find((i) => i.title.startsWith(prefix));
    if (!issue && finding.priority > 2) continue;
    const scope = finding.scope.repository
      ? `Image repository: \`${finding.scope.repository}\``
      : `Scan image: \`${finding.scope.image}\``;
    const description = `Container vulnerability on main.\n\n${scope}\n\n${[...finding.occurrences].sort().join("\n")}\n\nDaily scan: https://github.com/${repo}/actions/workflows/container-security.yml\n\nA merge is not a customer deployment; publish and communicate the patched chart/image.`;
    if (dryRun) {
      console.log(`${issue ? "update" : "create"} ${finding.title}`);
      continue;
    }
    if (!issue) {
      await createIssue(apiKey, { ...finding, description });
    } else {
      const input = { description, priority: finding.priority };
      if (["completed", "canceled"].includes(issue.state.type)) input.stateId = LINEAR_TRIAGE_STATE_ID;
      if (issue.description === description && issue.priority === input.priority && !input.stateId) continue;
      const data = await linearRequest(
        apiKey,
        `mutation UpdateContainerIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) { success }
      }`,
        { id: issue.id, input }
      );
      if (!data.issueUpdate.success) throw new Error(`Could not update ${issue.id}`);
    }
  }
  let done;
  for (const issue of plan.close) {
    if (dryRun) {
      console.log(`close ${issue.title}`);
      continue;
    }
    done ??= await resolveDoneStateId(apiKey);
    await setIssueState(apiKey, issue.id, done);
  }
  if (!plan.complete)
    throw new Error(
      `Incomplete image scan: ${plan.close.length} tickets resolved in successful or removed scopes; other tickets retained. Inspect failed jobs/artifacts.`
    );
  console.log(
    `Complete inventory: ${inventory.length} images. ${plan.current.size} vulnerability groups; ${plan.close.length} resolved tickets.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
