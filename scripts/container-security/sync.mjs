import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  LINEAR_TEAM_ID,
  createIssue,
  linearRequest,
  resolveDoneStateId,
  setIssueState,
} from "../dependabot-to-linear.mjs";
import { imageRepository } from "./scan.mjs";

// Kernel headers for compiling against glibc. Containers run the host's kernel, so its CVEs never apply.
const IGNORED_PACKAGES = new Set(["linux-libc-dev"]);
// Upstream image CVEs are unassessed maintenance work, so they top out at High; Urgent is for our own security bugs.
const PRIORITY_BY_SEVERITY = { CRITICAL: 2, HIGH: 3 };
// Per-CVE titles from before per-image grouping: `[Container <repo> <key>] <CVE> in <package>`.
const LEGACY_TITLE = /^\[Container [^\]]+\] \S+ in \S+$/;
// Tickets are kept out of Engineering triage: they track dependency maintenance, not assessed vulnerabilities.
const LINEAR_BACKLOG_STATE_ID = "74fa7d3b-6dba-4dbb-b88a-2febcb0b35bf"; // Backlog
const LINEAR_CANCELED_STATE_ID = "8df294bf-6430-4686-aa12-4161b849e4a1"; // Canceled
const LINEAR_CONTAINER_SCAN_LABEL_ID = "4a766aa3-2a4a-416f-ba80-834333907cd6"; // container-scan

const ticketPrefix = (repo, identity) =>
  `[Container ${repo} ${createHash("sha256").update(identity).digest("hex").slice(0, 24)}]`;

export function findings(repo, results) {
  const groups = new Map();
  const images = new Map();
  for (const result of results) {
    if (result.errors.length) {
      const prefix = ticketPrefix(repo, `scan-error:${result.image}`);
      groups.set(prefix, {
        title: `${prefix} Cannot scan ${result.image}`,
        priority: 2,
        scope: { image: result.image },
        occurrences: new Set(
          result.errors.map((error) => `- Scan failure: ${error}. Sources: ${result.sources.join(", ")}`)
        ),
      });
    }
    const image = imageRepository(result.image);
    if (!images.has(image))
      images.set(image, { scans: new Set(), vulnerabilities: new Map(), lower: new Set() });
    const entry = images.get(image);
    for (const scan of result.scans) {
      entry.scans.add(
        `- ${result.image} (${scan.platform}, ${scan.digest}). Sources: ${result.sources.join(", ")}`
      );
      for (const target of scan.report.Results) {
        for (const vuln of target.Vulnerabilities ?? []) {
          if (IGNORED_PACKAGES.has(vuln.PkgName)) continue;
          const severity = vuln.Severity?.toUpperCase();
          const id = `${vuln.VulnerabilityID} in ${vuln.PkgName} (${target.Type})`;
          if (!PRIORITY_BY_SEVERITY[severity]) {
            entry.lower.add(id);
            continue;
          }
          if (!entry.vulnerabilities.has(id)) entry.vulnerabilities.set(id, { severity, details: new Map() });
          const finding = entry.vulnerabilities.get(id);
          if (PRIORITY_BY_SEVERITY[severity] < PRIORITY_BY_SEVERITY[finding.severity])
            finding.severity = severity;
          const detail = `${result.image}: ${vuln.InstalledVersion}, fix: ${vuln.FixedVersion || "not available"}`;
          if (!finding.details.has(detail)) finding.details.set(detail, new Set());
          finding.details.get(detail).add(scan.platform);
        }
      }
    }
  }
  // One ticket per image repository, open while any tag or architecture has a critical/high finding.
  for (const [image, entry] of images) {
    if (!entry.vulnerabilities.size) continue;
    const prefix = ticketPrefix(repo, JSON.stringify(["image", image]));
    const listed = [...entry.vulnerabilities].map(
      ([id, { severity, details }]) =>
        `- ${severity} ${id}: ${[...details]
          .map(([detail, platforms]) => `${detail} (${[...platforms].sort().join(", ")})`)
          .sort()
          .join("; ")}`
    );
    const lower = [...entry.lower].filter((id) => !entry.vulnerabilities.has(id)).length;
    groups.set(prefix, {
      title: `${prefix} Critical/high vulnerabilities in ${image}`,
      priority: Math.min(...[...entry.vulnerabilities.values()].map((v) => PRIORITY_BY_SEVERITY[v.severity])),
      scope: { repository: image },
      occurrences: new Set([
        ...listed,
        ...(lower ? [`\nNot listed: ${lower} medium/low/unrated findings. See the scan artifacts.`] : []),
      ]),
      scans: entry.scans,
    });
  }
  return groups;
}

export function description(repo, finding) {
  const scope = finding.scope.repository
    ? `Image repository: \`${finding.scope.repository}\``
    : `Scan image: \`${finding.scope.image}\``;
  const scans = finding.scans ? `\n\nScanned:\n${[...finding.scans].sort().join("\n")}` : "";
  const occurrences = [...finding.occurrences].sort(
    (a, b) => a.startsWith("\n") - b.startsWith("\n") || a.localeCompare(b)
  );
  return `Container vulnerability on main.\n\n${scope}\n\n${occurrences.join("\n")}${scans}\n\nDaily scan: https://github.com/${repo}/actions/workflows/container-security.yml\n\nA merge is not a customer deployment; publish and communicate the patched chart/image.`;
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
  const resolved = existing.filter(
    (issue) =>
      !activePrefixes.has(prefixOf(issue.title)) &&
      !["completed", "canceled"].includes(issue.state.type) &&
      canClose(issue)
  );
  return {
    complete,
    current,
    close: resolved.filter((issue) => !LEGACY_TITLE.test(issue.title)),
    // The image's ticket now lists what is still present. Only untouched triage tickets are canceled:
    // one someone already assessed or started on is left for its owner.
    supersede: resolved.filter((issue) => LEGACY_TITLE.test(issue.title) && issue.state.type === "triage"),
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
    const body = description(repo, finding);
    if (dryRun) {
      console.log(`${issue ? "update" : "create"} ${finding.title}`);
      continue;
    }
    if (!issue) {
      await createIssue(apiKey, {
        title: finding.title,
        description: body,
        priority: finding.priority,
        stateId: LINEAR_BACKLOG_STATE_ID,
        labelIds: [LINEAR_CONTAINER_SCAN_LABEL_ID],
      });
    } else {
      const input = { description: body, priority: finding.priority };
      if (["completed", "canceled"].includes(issue.state.type)) input.stateId = LINEAR_BACKLOG_STATE_ID;
      if (issue.description === body && issue.priority === input.priority && !input.stateId) continue;
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
  for (const issue of plan.supersede) {
    if (dryRun) {
      console.log(`supersede ${issue.title}`);
      continue;
    }
    await setIssueState(apiKey, issue.id, LINEAR_CANCELED_STATE_ID);
  }
  if (!plan.complete)
    throw new Error(
      `Incomplete image scan: ${plan.close.length + plan.supersede.length} tickets resolved in successful or removed scopes; other tickets retained. Inspect failed jobs/artifacts.`
    );
  console.log(
    `Complete inventory: ${inventory.length} images. ${plan.current.size} tickets; ${plan.close.length} resolved; ${plan.supersede.length} superseded per-CVE tickets.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
