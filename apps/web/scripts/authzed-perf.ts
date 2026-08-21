import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import type { WriteStream } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";

/**
 * ENG-1739 — authorization performance at BI-like scale.
 *
 * Two phases, deliberately separate commands. AuthZed's load-testing guidance is explicit that the
 * relationships a measurement reads must be seeded beforehand, not written during the run, or you
 * measure your own writes and a cold cache instead of the workload.
 *
 *   pnpm authzed:perf seed  [--scale=small|default|large]
 *   pnpm authzed:perf run   [--iterations=N] [--concurrency=N] [--log=path]
 *   pnpm authzed:perf clean
 *
 * `seed` fills Postgres only. Project the relationships into SpiceDB afterwards with the ENG-1718
 * tooling rather than duplicating relationship writes here:
 *
 *   pnpm authzed:backfill --apply --scope=all
 *
 * `seed` is idempotent — it removes a previous seed first — and `clean` removes every row the seed
 * created and nothing else. Both target only rows tagged with `SEED_TAG`, but note this writes tens
 * of thousands of rows into whatever database `.env` points at, so point it at a throwaway one.
 *
 * `run` drives the real `can()` — real evaluator, real Prisma, real SpiceDB when enforcement is on —
 * and writes one JSON object per sample to a log file plus a summary to stdout.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT
 *
 * It measures the cost of an authorization decision per action and resource type. It does NOT measure
 * how many decisions a page or endpoint makes — request amplification needs the per-request counter
 * that ENG-1739's instrumentation change adds, because nothing counts checks per request today. The
 * N+1 question ("does a 6k-survey workspace still issue O(1) checks?") is answered by that counter
 * plus an assertion, not by this script. Read a green run here as "each check is affordable", never
 * as "the list paths are fine".
 *
 * Latency numbers from a laptop are indicative only: local SpiceDB has no network in the path, and a
 * shared machine is noisy. Percentiles belong in a report, not in a CI gate.
 */

type TScale = "small" | "default" | "large";

type TScaleProfile = Readonly<{
  responsesOnHotSurvey: number;
  surveysInHotWorkspace: number;
  teams: number;
  users: number;
  workspaces: number;
}>;

/**
 * Sized per axis to the query each one stresses, not uniformly large.
 *
 * Surveys and responses grow Postgres and the scope resolvers; they do not grow the SpiceDB graph at
 * all, because only organization, team, workspace and api_key are projected today — a survey is
 * resolved to its owning workspace before any check. Users, teams and grants are what the graph is
 * made of. Responses concentrate on ONE survey because export and analytics read a single survey's
 * responses; a million spread thinly across six thousand surveys stresses nothing.
 */
const SCALE_PROFILES = {
  small: { responsesOnHotSurvey: 2_000, surveysInHotWorkspace: 300, teams: 10, users: 50, workspaces: 5 },
  default: {
    responsesOnHotSurvey: 50_000,
    surveysInHotWorkspace: 6_000,
    teams: 100,
    users: 2_000,
    workspaces: 50,
  },
  large: {
    responsesOnHotSurvey: 500_000,
    surveysInHotWorkspace: 6_000,
    teams: 200,
    users: 5_000,
    workspaces: 100,
  },
} as const satisfies Readonly<Record<TScale, TScaleProfile>>;

const SEED_TAG = "eng1739-perf";
const SEED_ORGANIZATION_NAME = `${SEED_TAG} org`;
const SEED_USER_EMAIL_PREFIX = `${SEED_TAG}-u`;
const DEFAULT_LOG_PATH = "authzed/perf-samples.jsonl";
const LOG_EXTENSION = ".jsonl";
const BATCH = 1_000;

type TSample = Readonly<{
  action: string;
  allowed: boolean | null;
  durationMs: number;
  error: string | null;
  role: string;
}>;

const parsePositiveSafeInteger = (name: string, value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
};

const parseArgs = (argv: ReadonlyArray<string>) => {
  const flag = (name: string): string | undefined =>
    argv
      .find((arg) => arg.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=");

  const scale = (flag("scale") ?? "default") as TScale;
  if (!(scale in SCALE_PROFILES)) {
    throw new Error(`Unknown --scale=${scale}. Use one of: ${Object.keys(SCALE_PROFILES).join(", ")}`);
  }

  const logPath = flag("log") ?? DEFAULT_LOG_PATH;
  if (!logPath.endsWith(LOG_EXTENSION)) {
    // The run truncates this path before streaming to it. A mistyped `--log` should not be able to
    // empty a source file, so require the extension the harness actually writes.
    throw new Error(`--log must end in ${LOG_EXTENSION} (got "${logPath}"); the run truncates it.`);
  }

  return {
    command: argv.find((arg) => !arg.startsWith("--")) ?? "help",
    concurrency: parsePositiveSafeInteger("concurrency", flag("concurrency"), 8),
    iterations: parsePositiveSafeInteger("iterations", flag("iterations"), 2_000),
    logPath,
    scale,
  };
};

/**
 * Remove everything a seed created, and nothing else.
 *
 * Deleting the organization cascades its workspaces (and their surveys and responses), teams,
 * memberships and API keys. `User` rows are global rather than organization-owned, so they are
 * removed separately by the seed's email prefix.
 */
const clean = async (): Promise<{ organizations: number; users: number }> => {
  const { count: organizations } = await prisma.organization.deleteMany({
    where: { name: SEED_ORGANIZATION_NAME },
  });
  const { count: users } = await prisma.user.deleteMany({
    where: { email: { startsWith: SEED_USER_EMAIL_PREFIX } },
  });

  return { organizations, users };
};

const chunk = <T>(items: ReadonlyArray<T>, size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
};

/** The role mix for a seeded membership: a few owners/managers, a couple of billing, mostly members. */
const roleForSeedIndex = (index: number): "owner" | "manager" | "billing" | "member" => {
  if (index === 0) return "owner";
  if (index < 5) return "manager";
  if (index < 8) return "billing";
  return "member";
};

const seed = async (scale: TScale): Promise<void> => {
  const profile = SCALE_PROFILES[scale];
  const startedAt = performance.now();
  console.log(`seeding scale=${scale}`, profile);

  // Idempotent by construction. The seed's user emails are unique-constrained, so without this a
  // second `seed` dies partway with P2002 and leaves a half-populated organization behind — which
  // `run` would then happily resolve and measure.
  const removed = await clean();
  if (removed.organizations > 0 || removed.users > 0) {
    console.log("  removed previous seed", removed);
  }

  const organization = await prisma.organization.create({ data: { name: SEED_ORGANIZATION_NAME } });

  // Users and memberships. The role mix mirrors a real tenant: a few owners/managers, mostly members
  // whose access arrives through teams — which is the interesting path, since owners short-circuit.
  const users = [];
  for (const batch of chunk([...new Array(profile.users).keys()], BATCH)) {
    const created = await prisma.$transaction(
      batch.map((index) =>
        prisma.user.create({
          data: { name: `${SEED_TAG}-u${index}`, email: `${SEED_TAG}-u${index}@perf.test` },
          select: { id: true },
        })
      )
    );
    users.push(...created);
    console.log(`  users ${users.length}/${profile.users}`);
  }

  await prisma.membership.createMany({
    data: users.map((user, index) => ({
      userId: user.id,
      organizationId: organization.id,
      accepted: true,
      role: roleForSeedIndex(index),
    })),
  });

  const teams = await prisma.$transaction(
    [...new Array(profile.teams).keys()].map((index) =>
      prisma.team.create({
        data: { name: `${SEED_TAG}-team${index}`, organizationId: organization.id },
        select: { id: true },
      })
    )
  );

  // Every member joins two teams: enough fan-out that a check has to walk, not so much that the
  // seed dominates the run.
  await prisma.teamUser.createMany({
    data: users.flatMap((user, index) => [
      { teamId: teams[index % teams.length].id, userId: user.id, role: "contributor" as const },
      { teamId: teams[(index + 1) % teams.length].id, userId: user.id, role: "contributor" as const },
    ]),
    skipDuplicates: true,
  });

  const workspaces = await prisma.$transaction(
    [...new Array(profile.workspaces).keys()].map((index) =>
      prisma.workspace.create({
        data: { name: `${SEED_TAG}-ws${index}`, organizationId: organization.id },
        select: { id: true },
      })
    )
  );

  await prisma.workspaceTeam.createMany({
    data: teams.flatMap((team, index) => [
      {
        teamId: team.id,
        workspaceId: workspaces[index % workspaces.length].id,
        permission: index % 3 === 0 ? ("manage" as const) : ("readWrite" as const),
      },
    ]),
    skipDuplicates: true,
  });

  // The hot workspace: the one the ticket describes, 5–6k surveys.
  const hotWorkspace = workspaces[0];
  for (const batch of chunk([...new Array(profile.surveysInHotWorkspace).keys()], BATCH)) {
    await prisma.survey.createMany({
      data: batch.map((index) => ({
        name: `${SEED_TAG}-survey${index}`,
        workspaceId: hotWorkspace.id,
        status: "inProgress" as const,
        type: "link" as const,
      })),
    });
    console.log(
      `  surveys ${Math.min(batch.at(-1)! + 1, profile.surveysInHotWorkspace)}/${profile.surveysInHotWorkspace}`
    );
  }

  const hotSurvey = await prisma.survey.findFirst({
    where: { workspaceId: hotWorkspace.id },
    select: { id: true },
  });

  if (hotSurvey) {
    for (const batch of chunk([...new Array(profile.responsesOnHotSurvey).keys()], BATCH)) {
      await prisma.response.createMany({
        data: batch.map(() => ({ surveyId: hotSurvey.id, finished: true, data: {}, meta: {} })),
      });
      console.log(`  responses ${batch.at(-1)! + 1}/${profile.responsesOnHotSurvey}`);
    }
  }

  console.log(
    JSON.stringify({
      durationSeconds: Math.round((performance.now() - startedAt) / 1000),
      hotSurveyId: hotSurvey?.id ?? null,
      hotWorkspaceId: hotWorkspace.id,
      organizationId: organization.id,
      phase: "seed",
      scale,
      teams: teams.length,
      users: users.length,
      workspaces: workspaces.length,
    })
  );
  console.log("\nNext: project the relationships, then measure:");
  console.log("  pnpm authzed:backfill --apply --scope=all");
  console.log("  pnpm authzed:perf run --iterations=2000");
  console.log("\nWhen you are done, remove every row this created:");
  console.log("  pnpm authzed:perf clean");
};

const percentile = (sorted: ReadonlyArray<number>, fraction: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];

const run = async (iterations: number, concurrency: number, logPath: string): Promise<number> => {
  const organization = await prisma.organization.findFirst({
    where: { name: SEED_ORGANIZATION_NAME },
    select: { id: true },
  });

  if (!organization) {
    console.error("No seeded data found. Run: pnpm authzed:perf seed");
    return 1;
  }

  const [workspace, survey, memberships] = await Promise.all([
    prisma.workspace.findFirst({ where: { organizationId: organization.id }, select: { id: true } }),
    prisma.survey.findFirst({
      where: { workspace: { organizationId: organization.id } },
      select: { id: true },
    }),
    // A subset of users, per AuthZed's guidance: checking every user flat produces an unrealistically
    // cold cache. This is the "largest number online at once" cohort.
    prisma.membership.findMany({
      where: { organizationId: organization.id },
      select: { userId: true, role: true },
      take: 200,
      orderBy: { userId: "asc" },
    }),
  ]);

  if (!workspace || !survey) {
    console.error("Seeded organization has no workspace or survey; re-run seed.");
    return 1;
  }

  if (memberships.length === 0) {
    // Every sample picks a principal out of this list. Empty means the seed was interrupted, and
    // letting it through would produce a full run of identical TypeErrors rather than a measurement.
    console.error("Seeded organization has no memberships; re-run seed.");
    return 1;
  }

  // Weighted toward positive checks: negative checks walk every branch of the graph looking for an
  // answer that is not there, so a negative-heavy mix measures a workload nobody runs.
  const cases = [
    { action: "organization.read", resource: { type: "organization", id: organization.id } },
    { action: "organization.manage", resource: { type: "organization", id: organization.id } },
    { action: "workspace.read", resource: { type: "workspace", id: workspace.id } },
    { action: "workspace.write", resource: { type: "workspace", id: workspace.id } },
    { action: "survey.read", resource: { type: "survey", id: survey.id } },
    { action: "survey.response_export", resource: { type: "survey", id: survey.id } },
  ] as const;

  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, "");

  const logStream: WriteStream = createWriteStream(logPath, { flags: "a" });
  const samples: TSample[] = [];

  const runOne =
    (collect: boolean): ((index: number) => Promise<void>) =>
    async (index: number): Promise<void> => {
      const membership = memberships[index % memberships.length];
      const testCase = cases[index % cases.length];
      const begunAt = performance.now();
      let allowed: boolean | null = null;
      let error: string | null = null;

      try {
        allowed = await can({ type: "user", id: membership.userId }, testCase.action, testCase.resource);
      } catch (error_) {
        error = error_ instanceof Error ? error_.name : "unknown";
      }

      const sample: TSample = {
        action: testCase.action,
        allowed,
        durationMs: performance.now() - begunAt,
        error,
        role: membership.role,
      };

      if (collect) {
        samples.push(sample);
        logStream.write(`${JSON.stringify(sample)}\n`);
      }
    };

  // Warmup: cold gRPC channel, DB connection pool, and SpiceDB cache all bias the first samples.
  // Running a throwaway batch before the timed phase means the reported percentiles reflect a warm
  // path, not one-time startup costs.
  // Concurrency is fixed at 8 regardless of the user's --concurrency flag — this is a throwaway
  // phase that only needs to touch every codepath once, not stress the system.
  const WARMUP_ITERATIONS = 100;
  const WARMUP_CONCURRENCY = 8;
  await withAuthorizationSurface("server_action", async () => {
    for (const batch of chunk([...new Array(WARMUP_ITERATIONS).keys()], WARMUP_CONCURRENCY)) {
      await Promise.all(batch.map(runOne(false)));
    }
  });

  // Keep the harness inside the same bounded request surface used by production actions so latency
  // and checks-per-request telemetry carry representative attributes.
  const startedAt = performance.now();
  await withAuthorizationSurface("server_action", async () => {
    for (const batch of chunk([...new Array(iterations).keys()], concurrency)) {
      await Promise.all(batch.map(runOne(true)));
    }
  });

  logStream.end();

  if (samples.length === 0) {
    // Asserted rather than inferred: with no samples every rate below is 0/0, `JSON.stringify`
    // renders NaN as null, and `errorRate > 0` is false — so the run would report measuring nothing
    // and still exit 0. A measurement tool must not have a green path that measured nothing.
    console.error("No samples were collected; nothing was measured.");
    return 1;
  }

  const wallSeconds = (performance.now() - startedAt) / 1000;
  const byAction = new Map<string, number[]>();
  for (const sample of samples) {
    // Push into the existing array rather than rebuilding it: spreading copies every duration
    // recorded so far on each sample, which is quadratic in samples-per-action.
    const durations = byAction.get(sample.action);
    if (durations) durations.push(sample.durationMs);
    else byAction.set(sample.action, [sample.durationMs]);
  }

  const report = {
    actions: Object.fromEntries(
      [...byAction.entries()].map(([action, durations]) => {
        const sorted = [...durations].sort((a, b) => a - b);
        return [
          action,
          {
            count: sorted.length,
            p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
            p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
            p99Ms: Number(percentile(sorted, 0.99).toFixed(2)),
          },
        ];
      })
    ),
    allowRate: Number((samples.filter((s) => s.allowed === true).length / samples.length).toFixed(3)),
    concurrency,
    errorRate: Number((samples.filter((s) => s.error !== null).length / samples.length).toFixed(4)),
    iterations: samples.length,
    logPath,
    phase: "run",
    throughputPerSecond: Number((samples.length / wallSeconds).toFixed(1)),
    wallSeconds: Number(wallSeconds.toFixed(1)),
  };

  console.log(JSON.stringify(report, null, 2));
  console.log(
    "\nRequest amplification and the list-path N+1 question are NOT answered here — they need the",
    "\nper-request check counter. This says each decision is affordable, not that a page makes few."
  );

  return report.errorRate > 0 ? 2 : 0;
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "seed") {
    await seed(args.scale);
    return;
  }

  if (args.command === "run") {
    process.exitCode = await run(args.iterations, args.concurrency, args.logPath);
    return;
  }

  if (args.command === "clean") {
    console.log("removed", await clean());
    return;
  }

  console.log(`Usage:
  pnpm authzed:perf seed  [--scale=small|default|large]
  pnpm authzed:perf run   [--iterations=2000] [--concurrency=8] [--log=authzed/perf-samples.jsonl]
  pnpm authzed:perf clean

\`seed\` is idempotent — it removes a previous seed before writing a new one. \`clean\` removes
every row the seed created and nothing else. Between seed and run, project the seeded rows
into SpiceDB:
  pnpm authzed:backfill --apply --scope=all`);
  process.exitCode = 1;
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
