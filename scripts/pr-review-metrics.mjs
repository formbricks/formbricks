#!/usr/bin/env node
// Reports review-shape metrics for merged PRs, so claims about how agent-authored code
// gets reviewed point at a number instead of a recollection.
//
// It exists because the "Improved Agentic Coding" project (ENG-2311) baselines five
// metrics, and three of them are only observable in PR history: how many times a PR goes
// back round after review, whether bug fixes ship a test, and which review bots actually
// run. `scripts/ci-timings.mjs` already covers the E2E wall clock; this covers the rest,
// so a milestone re-check is one command instead of a manual trawl.
//
// Definitions used here — worth reading before quoting a number:
//
//   round trip   A push by the PR author that lands after review feedback already
//                existed on the PR. Commits are clustered into pushes with a gap
//                threshold, because the API exposes commits, not pushes. A PR reviewed
//                once and merged unchanged has 0 round trips.
//   feedback     A review submitted as CHANGES_REQUESTED or COMMENTED, or a review
//                comment. An APPROVED review with no body is not feedback: nothing was
//                asked for, so nothing can come back round.
//   test-bearing A diff touching a path that matches TEST_PATH — `*.test.*`, `*.spec.*`
//                or a `__tests__` directory. It does NOT prove the test failed before
//                the fix; that needs running the test against the parent commit, which
//                this script deliberately does not attempt. Treat it as the ceiling on
//                the failing-test-first rate, not the rate itself.
//
// Usage:
//   node scripts/pr-review-metrics.mjs --since 2026-08-01
//   node scripts/pr-review-metrics.mjs --since 2026-08-01 --until 2026-08-20
//   node scripts/pr-review-metrics.mjs --since 2026-08-01 --prefix fix   # only `fix:` PRs
//   node scripts/pr-review-metrics.mjs --since 2026-08-01 --csv         # per-PR rows
//
// Env:
//   GITHUB_TOKEN | GH_TOKEN  token with `pull_requests: read` on the repo
//   GITHUB_REPOSITORY        "owner/repo" (defaults to formbricks/formbricks)

const API = "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY || "formbricks/formbricks";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// Commits landing within this window of each other are treated as one push. Chosen
// because a rebase or a squash-then-push rewrites several commit timestamps within
// seconds, and counting those as separate round trips would inflate every number here.
const PUSH_CLUSTER_SECONDS = 10 * 60;

// Anchored on the extension so an OpenAPI path file like `api_v3_workflows_{id}_test.yml`
// does not read as a test — it is a spec fragment, and counting it would overstate the rate.
const TEST_PATH_RE = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/;

// A merged PR's own merge commit and any base-branch merges are not author iteration.
const MERGE_SUBJECT_RE = /^Merge (branch|remote-tracking branch|pull request) /;

const readFlag = (name, fallback = undefined) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const mean = (values) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

const round = (n, places = 2) => (n === null ? "—" : Number(n.toFixed(places)));

const pct = (part, whole) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`);

const api = async (path) => {
  if (!TOKEN) {
    throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required — needs `pull_requests: read` scope.");
  }
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${TOKEN}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
};

/**
 * Merged PRs into the default branch within the window, by merge date — merge date, not
 * open date, is what puts a PR in a given release's population.
 *
 * Deliberately the plain list endpoint rather than `/search/issues`, despite search
 * offering a `merged:` filter: search carries a much tighter rate limit, lags behind
 * writes, and is blocked outright on some networks. Paging `state=closed` sorted by
 * update time costs a few more calls and always agrees with the repo.
 */
const mergedPulls = async (since, until) => {
  const from = new Date(`${since}T00:00:00Z`).getTime();
  // An `--until` day is inclusive: a PR merged at 16:00 that day is in the window.
  const to = until ? new Date(`${until}T23:59:59Z`).getTime() : Infinity;
  const pulls = [];

  for (let page = 1; page <= 20; page++) {
    const batch = await api(
      `/repos/${REPO}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100&page=${page}`
    );
    if (batch.length === 0) break;

    for (const pull of batch) {
      if (!pull.merged_at) continue;
      const mergedAt = new Date(pull.merged_at).getTime();
      if (mergedAt >= from && mergedAt <= to) pulls.push(pull);
    }

    // A merged PR stops being touched shortly after it merges, so updated_at >= merged_at.
    // Once a whole page predates the window, no later page can re-enter it.
    const newest = Math.max(...batch.map((p) => new Date(p.updated_at).getTime()));
    if (newest < from) break;
  }

  return pulls;
};

const isBot = (user) => user?.type === "Bot" || /\[bot\]$/.test(user?.login ?? "");

/** Group sorted timestamps into pushes, so a rebase is one round trip and not six. */
const clusterIntoPushes = (timestamps) => {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const pushes = [];

  for (const at of sorted) {
    const last = pushes[pushes.length - 1];
    if (last !== undefined && at - last <= PUSH_CLUSTER_SECONDS * 1000) {
      pushes[pushes.length - 1] = at;
      continue;
    }
    pushes.push(at);
  }

  return pushes;
};

const analysePull = async (pull) => {
  const number = pull.number;
  const [reviews, comments, commits, files] = await Promise.all([
    api(`/repos/${REPO}/pulls/${number}/reviews?per_page=100`),
    api(`/repos/${REPO}/pulls/${number}/comments?per_page=100`),
    api(`/repos/${REPO}/pulls/${number}/commits?per_page=100`),
    api(`/repos/${REPO}/pulls/${number}/files?per_page=100`),
  ]);

  // Feedback, not approval: an approval with no body asks for nothing, so it cannot
  // start a round trip. Review comments count wherever they came from.
  const feedback = [
    ...reviews.filter((r) => r.state === "CHANGES_REQUESTED" || (r.state === "COMMENTED" && r.body)),
    ...comments,
  ];

  const humanFeedback = feedback.filter((f) => !isBot(f.user));
  const botFeedback = feedback.filter((f) => isBot(f.user));

  const feedbackTimes = feedback
    .map((f) => new Date(f.submitted_at ?? f.created_at).getTime())
    .filter((t) => !Number.isNaN(t));
  const firstFeedbackAt = feedbackTimes.length > 0 ? Math.min(...feedbackTimes) : null;

  // Author commits only. A maintainer's suggestion-commit or a backport bot's commit is
  // not the author iterating in response to review.
  const authorLogin = pull.user?.login;
  const authorCommitTimes = commits
    .filter((c) => !MERGE_SUBJECT_RE.test(c.commit?.message ?? ""))
    .filter((c) => {
      const login = c.author?.login;
      // Fall back to the committer date when GitHub cannot map the commit to an account,
      // which happens for agent-authored commits pushed under a bare git identity.
      return login === undefined || login === null || login === authorLogin;
    })
    .map((c) => new Date(c.commit?.committer?.date ?? c.commit?.author?.date).getTime())
    .filter((t) => !Number.isNaN(t));

  const roundTrips =
    firstFeedbackAt === null
      ? 0
      : clusterIntoPushes(authorCommitTimes.filter((t) => t > firstFeedbackAt)).length;

  const reviewerLogins = [...new Set(feedback.map((f) => f.user?.login).filter(Boolean))];

  return {
    number,
    title: pull.title,
    author: authorLogin,
    mergedAt: pull.closed_at,
    humanFeedback: humanFeedback.length,
    botFeedback: botFeedback.length,
    roundTrips,
    reviewers: reviewerLogins,
    humanReviewers: reviewerLogins.filter((l) => !/\[bot\]$/.test(l)),
    botReviewers: reviewerLogins.filter((l) => /\[bot\]$/.test(l)),
    touchesTests: files.some((f) => TEST_PATH_RE.test(f.filename)),
    changedFiles: files.length,
    truncatedFiles: files.length === 100,
  };
};

const conventionalPrefix = (title) => (title.match(/^(\w+)(\([^)]*\))?!?:/) ?? [])[1] ?? "none";

const report = (rows, label) => {
  if (rows.length === 0) {
    console.log(`\n${label}: no PRs matched.`);
    return;
  }

  const reviewed = rows.filter((r) => r.humanFeedback > 0 || r.botFeedback > 0);
  const humanReviewed = rows.filter((r) => r.humanFeedback > 0);
  const roundTrips = reviewed.map((r) => r.roundTrips);

  console.log(`\n${label} — n=${rows.length} merged PRs`);
  console.log(`  with any review feedback     ${reviewed.length} (${pct(reviewed.length, rows.length)})`);
  console.log(
    `  with human review feedback   ${humanReviewed.length} (${pct(humanReviewed.length, rows.length)})`
  );
  console.log(
    `  round trips (reviewed PRs)   mean ${round(mean(roundTrips))}  median ${round(median(roundTrips))}`
  );
  console.log(
    `  round trips = 0              ${roundTrips.filter((n) => n === 0).length}/${roundTrips.length}`
  );
  console.log(
    `  test-bearing diffs           ${rows.filter((r) => r.touchesTests).length} (${pct(rows.filter((r) => r.touchesTests).length, rows.length)})`
  );
};

const main = async () => {
  const since = readFlag("since");
  if (!since) {
    console.log("Usage:");
    console.log("  node scripts/pr-review-metrics.mjs --since YYYY-MM-DD [--until YYYY-MM-DD]");
    console.log("                                     [--prefix fix] [--csv]");
    process.exitCode = 1;
    return;
  }

  const until = readFlag("until");
  const prefix = readFlag("prefix");

  const pulls = await mergedPulls(since, until);
  const selected = prefix ? pulls.filter((p) => conventionalPrefix(p.title) === prefix) : pulls;

  console.log(
    `Merged PRs into main, ${since}${until ? `..${until}` : " onwards"}: ${pulls.length}` +
      (prefix ? ` (${selected.length} with prefix "${prefix}:")` : "")
  );

  const rows = [];
  // Sequential per PR (four calls fan out inside each) to stay clear of secondary rate
  // limits — this is a diagnostic, not a hot path.
  for (const pull of selected) {
    rows.push(await analysePull(pull));
  }

  const truncated = rows.filter((r) => r.truncatedFiles);
  if (truncated.length > 0) {
    console.log(
      `\nNote: ${truncated.length} PR(s) changed 100+ files; the file list is paginated at 100, ` +
        `so "test-bearing" is a floor for those: ${truncated.map((r) => `#${r.number}`).join(", ")}`
    );
  }

  report(rows, "All selected PRs");

  const fixes = rows.filter((r) => conventionalPrefix(r.title) === "fix");
  if (!prefix && fixes.length > 0) {
    report(fixes, 'Bug-fix PRs ("fix:")');
  }

  // Which review identities actually run. The shared-review-skill metric turns on this:
  // a skill nobody runs leaves no trace here.
  const byReviewer = new Map();
  for (const row of rows) {
    for (const login of row.reviewers) {
      byReviewer.set(login, (byReviewer.get(login) ?? 0) + 1);
    }
  }

  console.log("\nReview participation (PRs with feedback from each identity)");
  for (const [login, count] of [...byReviewer.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${login}`);
  }

  if (hasFlag("csv")) {
    console.log("\nnumber,author,merged_at,human_feedback,bot_feedback,round_trips,touches_tests,title");
    for (const r of rows) {
      const title = `"${r.title.replace(/"/g, '""')}"`;
      console.log(
        [
          r.number,
          r.author,
          r.mergedAt,
          r.humanFeedback,
          r.botFeedback,
          r.roundTrips,
          r.touchesTests,
          title,
        ].join(",")
      );
    }
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
