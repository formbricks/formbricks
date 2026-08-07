#!/usr/bin/env node
// Reports GitHub Actions timings for the "PR Update" workflow, so CI performance
// regressions are measurable instead of anecdotal.
//
// It exists because the E2E job intermittently stalled from ~13min to 50min (ENG-2274)
// and nothing in the repo made that visible: you had to click into a run and eyeball the
// step list. This prints the same information as a table, and aggregates across runs so
// p50/p95 and outliers are one command away.
//
// Usage:
//   node scripts/ci-timings.mjs --run 31164877710        # per-step table for one run
//   node scripts/ci-timings.mjs --last 20                # aggregate the last 20 runs
//   node scripts/ci-timings.mjs --last 20 --event merge_group
//   node scripts/ci-timings.mjs --last 20 --job "Run E2E Tests"
//
// Env:
//   GITHUB_TOKEN | GH_TOKEN  token with `actions: read` on the repo
//   GITHUB_REPOSITORY        "owner/repo" (defaults to formbricks/formbricks)

const API = "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY || "formbricks/formbricks";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// Steps slower than this in a healthy run are worth a look. Tuned to sit just above the
// observed healthy maximum for the E2E job's two big steps (build ~4m31s, tests ~6m26s).
const SLOW_STEP_SECONDS = 8 * 60;

const readFlag = (name, fallback = undefined) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const fmt = (seconds) => {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
};

const seconds = (from, to) => {
  if (!from || !to) return null;
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000;
};

const percentile = (sorted, p) => {
  if (sorted.length === 0) return null;
  // Nearest-rank: for small samples this is easier to reason about than interpolation,
  // and "the 95th-percentile run" stays an actual run that happened.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1];
};

const api = async (path) => {
  if (!TOKEN) {
    throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required — needs `actions: read` scope.");
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

const jobsForRun = async (runId) => {
  const { jobs } = await api(`/repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`);
  return jobs;
};

/** Per-step breakdown for a single run, for every job or just the one matching --job. */
const reportRun = async (runId, jobFilter) => {
  const jobs = await jobsForRun(runId);
  const matching = jobs.filter((j) => !jobFilter || j.name.includes(jobFilter));

  if (matching.length === 0) {
    console.log(`No jobs in run ${runId} matching ${JSON.stringify(jobFilter)}.`);
    console.log(`Available: ${jobs.map((j) => j.name).join(", ")}`);
    return;
  }

  for (const job of matching) {
    const total = seconds(job.started_at, job.completed_at);
    console.log(`\n${job.name} — ${job.status}/${job.conclusion ?? "…"} — total ${fmt(total)}`);
    console.log(`  ${job.html_url}`);
    console.log("");

    for (const step of job.steps ?? []) {
      const dur = seconds(step.started_at, step.completed_at);
      // Skip the long tail of sub-second setup/teardown steps; they're pure noise here.
      if (dur !== null && dur < 2 && step.conclusion !== "failure") continue;
      const flag = dur !== null && dur >= SLOW_STEP_SECONDS ? "  <-- slow" : "";
      const skipped = step.conclusion === "skipped" ? " (skipped)" : "";
      console.log(`  ${fmt(dur).padStart(7)}  ${step.name}${skipped}${flag}`);
    }
  }
};

/** Aggregate job durations across the last N runs of the PR Update workflow. */
const reportAggregate = async (last, event, jobFilter) => {
  const query = new URLSearchParams({ per_page: String(last), status: "completed" });
  if (event) query.set("event", event);

  const { workflow_runs: runs } = await api(
    `/repos/${REPO}/actions/workflows/pr.yml/runs?${query.toString()}`
  );

  if (runs.length === 0) {
    console.log("No runs matched.");
    return;
  }

  console.log(`Sampling ${runs.length} runs of pr.yml${event ? ` (event=${event})` : ""}\n`);

  const rows = [];
  // Sequential on purpose: this is a diagnostic run by a human or an agent, and hammering
  // the API in parallel just risks secondary rate limits for no useful speedup.
  for (const run of runs) {
    const jobs = await jobsForRun(run.id);
    const job = jobs.find((j) => j.name.includes(jobFilter));
    if (!job) continue;
    rows.push({
      id: run.id,
      conclusion: job.conclusion,
      duration: seconds(job.started_at, job.completed_at),
      url: job.html_url,
    });
  }

  const measured = rows.filter((r) => r.duration !== null);
  if (measured.length === 0) {
    console.log(`No job matching ${JSON.stringify(jobFilter)} in the sampled runs.`);
    return;
  }

  for (const row of measured) {
    const flag = row.duration >= 20 * 60 ? "  <-- OVER 20min" : "";
    // A cancelled or still-reporting job has `conclusion: null` even when the parent run
    // says "completed" — don't let that abort a report the loop above already paid for.
    const conclusion = row.conclusion ?? "unknown";
    console.log(`  ${fmt(row.duration).padStart(8)}  ${conclusion.padEnd(9)}  ${row.id}${flag}`);
  }

  const sorted = measured.map((r) => r.duration).sort((a, b) => a - b);
  console.log(`\n  n=${sorted.length}`);
  console.log(`  min  ${fmt(sorted[0])}`);
  console.log(`  p50  ${fmt(percentile(sorted, 50))}`);
  console.log(`  p95  ${fmt(percentile(sorted, 95))}`);
  console.log(`  max  ${fmt(sorted[sorted.length - 1])}`);

  const over = measured.filter((r) => r.duration >= 20 * 60);
  console.log(`  runs over 20min: ${over.length}/${measured.length}`);
  for (const row of over) {
    console.log(`    ${row.url}`);
  }
};

const main = async () => {
  const runId = readFlag("run");
  const last = readFlag("last");
  const event = readFlag("event");
  const jobFilter = readFlag("job", "Run E2E Tests");

  if (runId) {
    await reportRun(runId, readFlag("job"));
    return;
  }

  if (last) {
    // `per_page` silently falls back to the API default for NaN/0 and is silently capped
    // at 100. Either would make the report claim a sample size it didn't actually use, and
    // the whole point of this tool is trustworthy numbers.
    const count = Number(last);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new Error(`--last must be an integer between 1 and 100, got ${JSON.stringify(last)}.`);
    }
    await reportAggregate(count, event, jobFilter);
    return;
  }

  console.log("Usage:");
  console.log("  node scripts/ci-timings.mjs --run <run-id> [--job <name-substring>]");
  console.log("  node scripts/ci-timings.mjs --last <n> [--event merge_group] [--job <name>]");
  process.exitCode = 1;
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
