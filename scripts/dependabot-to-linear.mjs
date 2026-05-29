#!/usr/bin/env node
// Syncs open GitHub Dependabot alerts into Linear issues.
// Runs daily in CI (.github/workflows/dependabot-to-linear.yml).
//
// For each open Dependabot alert it creates one Linear issue (if not already
// present), on the Engineering team, in the Todo state, with the `security`
// label and a priority mapped from the alert severity. It is idempotent:
// issues are matched by a stable `[Dependabot #<number>]` title prefix, so
// re-running never creates duplicates.
//
// Env:
//   GITHUB_REPOSITORY      "owner/repo" (provided automatically in Actions)
//   DEPENDABOT_ALERTS_TOKEN  token with "Dependabot alerts: read" (the default
//                            GITHUB_TOKEN cannot read this API)
//   LINEAR_API_KEY | LINEAR_ACCESS_KEY  Linear personal API key with BOTH
//                            `read` (to dedupe against existing issues) and
//                            `write` / `issues:create` (to create new ones).
//                            Generated at Settings → API → Personal API keys.
// Flags:
//   --dry-run  log what would be created without writing to Linear

const DRY_RUN = process.argv.includes("--dry-run");

const LINEAR_TEAM_ID = "272e6dd2-fcab-4270-be37-1626dce35d2c"; // Engineering
const LINEAR_TODO_STATE_ID = "c32c8340-e8f8-48f4-a863-afabe3b19e17"; // Todo
const LINEAR_SECURITY_LABEL_ID = "f9c50a45-3bd9-45e7-a70a-5b88aba910f9"; // security
// The Engineering team uses T-shirt estimation, where the estimate is a plain
// integer the UI renders as a size: 1=XS, 2=S, 3=M, 5=L. We default every
// Dependabot issue to "S".
const LINEAR_ESTIMATE_S = 2;

// Dependabot severity -> Linear priority (0 none, 1 urgent, 2 high, 3 medium, 4 low)
const PRIORITY_BY_SEVERITY = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const LINEAR_API_URL = "https://api.linear.app/graphql";

// Abort any outbound request that hangs, so a stuck connection can't tie up the
// runner until the workflow-level timeout.
const FETCH_TIMEOUT_MS = 30000;

function requireEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  throw new Error(`Missing required env var: ${[name, ...fallbacks].join(" or ")}`);
}

// The Dependabot alerts endpoint uses cursor pagination (`before`/`after`),
// not `?page=`. The next-page cursor is returned in the response `Link` header
// as `<url>; rel="next"`. Walk that until there's no next link.
function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function fetchOpenAlerts(repo, token) {
  const alerts = [];
  let url = `https://api.github.com/repos/${repo}/dependabot/alerts?state=open&per_page=100`;
  while (url) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "formbricks-dependabot-to-linear",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status} fetching Dependabot alerts: ${body.slice(0, 500)}`);
    }
    const batch = await res.json();
    alerts.push(...batch);
    url = parseNextLink(res.headers.get("link"));
  }
  return alerts;
}

async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Linear API error: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  }
  return json.data;
}

async function issueExists(apiKey, titlePrefix) {
  const data = await linearRequest(
    apiKey,
    `query ExistingIssue($teamId: ID!, $prefix: String!) {
      issues(filter: { team: { id: { eq: $teamId } }, title: { startsWith: $prefix } }, first: 1) {
        nodes { id }
      }
    }`,
    { teamId: LINEAR_TEAM_ID, prefix: titlePrefix }
  );
  return data.issues.nodes.length > 0;
}

async function createIssue(apiKey, { title, description, priority }) {
  const data = await linearRequest(
    apiKey,
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { identifier url }
      }
    }`,
    {
      input: {
        teamId: LINEAR_TEAM_ID,
        stateId: LINEAR_TODO_STATE_ID,
        labelIds: [LINEAR_SECURITY_LABEL_ID],
        estimate: LINEAR_ESTIMATE_S,
        title,
        description,
        priority,
      },
    }
  );
  if (!data.issueCreate.success) {
    throw new Error(`Linear issueCreate returned success=false for: ${title}`);
  }
  return data.issueCreate.issue;
}

function buildIssue(alert) {
  const number = alert.number;
  const severity = alert.security_vulnerability?.severity ?? "medium";
  const priority = PRIORITY_BY_SEVERITY[severity] ?? 3;
  const pkg = alert.dependency?.package?.name ?? "unknown package";
  const ecosystem = alert.dependency?.package?.ecosystem ?? "";
  const advisory = alert.security_advisory ?? {};
  const vuln = alert.security_vulnerability ?? {};
  const summary = advisory.summary ?? "Security vulnerability";
  const ghsa = advisory.ghsa_id ?? "";
  const cve = advisory.cve_id ?? "";
  const patched = vuln.first_patched_version?.identifier ?? "no patched version yet";
  const range = vuln.vulnerable_version_range ?? "unknown";

  const titlePrefix = `[Dependabot #${number}]`;
  const title = `${titlePrefix} ${pkg} — ${summary}`;

  const description = [
    `**Dependabot alert [#${number}](${alert.html_url})**`,
    "",
    `- **Package:** \`${pkg}\`${ecosystem ? ` (${ecosystem})` : ""}`,
    `- **Severity:** ${severity}`,
    ghsa ? `- **Advisory:** ${ghsa}` : null,
    cve ? `- **CVE:** ${cve}` : null,
    `- **Affected versions:** ${range}`,
    `- **Patched version:** ${patched}`,
    "",
    advisory.description ? advisory.description : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { titlePrefix, title, description, priority };
}

async function main() {
  const repo = requireEnv("GITHUB_REPOSITORY");
  const ghToken = requireEnv("DEPENDABOT_ALERTS_TOKEN");
  const linearKey = requireEnv("LINEAR_API_KEY", "LINEAR_ACCESS_KEY");

  console.log(`Fetching open Dependabot alerts for ${repo}${DRY_RUN ? " (dry run)" : ""}…`);
  const alerts = await fetchOpenAlerts(repo, ghToken);
  console.log(`Found ${alerts.length} open alert(s).`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const alert of alerts) {
    const issue = buildIssue(alert);
    try {
      if (await issueExists(linearKey, issue.titlePrefix)) {
        skipped += 1;
        console.log(`skip   ${issue.titlePrefix} (already in Linear)`);
        continue;
      }
      if (DRY_RUN) {
        created += 1;
        console.log(`would  ${issue.title} [priority ${issue.priority}]`);
        continue;
      }
      const result = await createIssue(linearKey, issue);
      created += 1;
      console.log(`create ${result.identifier} ${result.url}`);
    } catch (err) {
      failed += 1;
      console.error(`error  ${issue.titlePrefix}: ${err.message}`);
    }
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}${DRY_RUN ? " (dry run)" : ""}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
