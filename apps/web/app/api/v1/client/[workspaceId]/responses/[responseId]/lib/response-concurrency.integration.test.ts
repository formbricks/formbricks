import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ResourceNotFoundError, ResponseAlreadyFinishedError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { lockResponseForUpdate } from "@/lib/response/service";
import { updateResponseWithQuotaEvaluation } from "./response";

/**
 * Client response updates against real Postgres, with a second write in flight (ENG-6869).
 *
 * The route rejects a finished response before it opens the write transaction. An update that read
 * the row before another request's finishing write committed therefore reaches the transaction with a
 * stale "unfinished" verdict. The transaction itself has to lock the row and look again. A mocked unit
 * test cannot tell the two apart: the defect is only in which write sees which committed state.
 *
 * Each test holds an open transaction that has already written the row, the way a concurrent request
 * does between its write and its commit. It then starts the client update, waits until Postgres
 * reports the update blocked on that row, and only then commits.
 */

beforeEach(async () => {
  await resetDb();
});

const seedUnfinishedResponse = async (name = "ENG-6869") => {
  const organization = await prisma.organization.create({ data: { name: `${name} org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${name} workspace`, organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "ENG-6869 survey", workspaceId: workspace.id, status: "inProgress" },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, data: {}, finished: false },
  });
  return { workspaceId: workspace.id, surveyId: survey.id, responseId: response.id };
};

/**
 * Writes the row inside a transaction and keeps it open, so the row lock is held until `commit()`.
 * `holderPid` is that transaction's backend, so the wait below can look for writers blocked on it alone.
 */
const holdOpenTransaction = async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
  let commit!: () => void;
  const commitSignal = new Promise<void>((resolve) => {
    commit = resolve;
  });
  let markWritten!: (pid: number) => void;
  const written = new Promise<number>((resolve) => {
    markWritten = resolve;
  });

  const committed = prisma.$transaction(
    async (tx) => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS "pid"`;
      await work(tx);
      markWritten(pid);
      await commitSignal;
    },
    { timeout: 20_000 }
  );

  // A failed write rejects here instead of leaving the caller waiting on `written` forever.
  const holderPid = await Promise.race([written, committed.then(() => -1)]);
  return { holderPid, commit, committed };
};

type TResponseWrite = Parameters<typeof prisma.response.update>[0]["data"];

const writeInOpenTransaction = (responseId: string, data: TResponseWrite) =>
  holdOpenTransaction((tx) => tx.response.update({ where: { id: responseId }, data }));

/** Resolves once another backend is blocked on the holder's lock, i.e. the update under test reached it. */
const waitForBlockedWriter = async (holderPid: number) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting"
      FROM pg_stat_activity
      WHERE ${holderPid}::int = ANY(pg_blocking_pids(pid))
    `;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The client update never blocked on the row lock");
};

/**
 * Starts `update` while `holder` keeps its write open, commits once the update is blocked on it, and
 * returns the update's outcome. Commits in `finally`, so a failure here never leaves the row locked for the
 * next test's reset.
 */
const raceAgainst = async <T>(
  holder: Awaited<ReturnType<typeof writeInOpenTransaction>>,
  update: () => Promise<T>
): Promise<T | unknown> => {
  // Settled into a value straight away, so a rejection is never unhandled while we wait.
  const outcome = update().then(
    (value) => value,
    (error: unknown) => error
  );
  try {
    await waitForBlockedWriter(holder.holderPid);
  } finally {
    holder.commit();
    await holder.committed;
  }
  return outcome;
};

const readResponse = (responseId: string) =>
  prisma.response.findUniqueOrThrow({
    where: { id: responseId },
    select: { finished: true, data: true, variables: true, ttc: true },
  });

describe("updateResponseWithQuotaEvaluation with a concurrent write (ENG-6869)", () => {
  test("an update racing the finishing write cannot reopen the response", async () => {
    const { workspaceId, surveyId, responseId } = await seedUnfinishedResponse();
    const finishing = await writeInOpenTransaction(responseId, { finished: true, data: { q1: "A" } });

    const outcome = await raceAgainst(finishing, () =>
      updateResponseWithQuotaEvaluation({
        responseId,
        workspaceId,
        surveyId,
        responseInput: { finished: false, data: { q1: "B" } },
      })
    );

    expect(outcome).toBeInstanceOf(ResponseAlreadyFinishedError);
    expect(await readResponse(responseId)).toMatchObject({ finished: true, data: { q1: "A" } });
  });

  test("an update racing the finishing write cannot change the finished answers", async () => {
    const { workspaceId, surveyId, responseId } = await seedUnfinishedResponse();
    const finishing = await writeInOpenTransaction(responseId, { finished: true, data: { q1: "A" } });

    const outcome = await raceAgainst(finishing, () =>
      updateResponseWithQuotaEvaluation({
        responseId,
        workspaceId,
        surveyId,
        responseInput: { data: { q1: "B" } },
      })
    );

    expect(outcome).toBeInstanceOf(ResponseAlreadyFinishedError);
    expect(await readResponse(responseId)).toMatchObject({ finished: true, data: { q1: "A" } });
  });

  test("two overlapping updates of an unfinished response keep each other's answers, variables and timings", async () => {
    const { workspaceId, surveyId, responseId } = await seedUnfinishedResponse();
    const first = await writeInOpenTransaction(responseId, {
      data: { q1: "A" },
      variables: { v1: "A" },
      ttc: { q1: 100 },
    });

    const outcome = await raceAgainst(first, () =>
      updateResponseWithQuotaEvaluation({
        responseId,
        workspaceId,
        surveyId,
        responseInput: { finished: true, data: { q2: "B" }, variables: { v2: "B" }, ttc: { q2: 200 } },
      })
    );

    const merged = {
      finished: true,
      data: { q1: "A", q2: "B" },
      variables: { v1: "A", v2: "B" },
      // Finishing totals the merged timings, so a dropped key would also show in `_total`.
      ttc: { q1: 100, q2: 200, _total: 300 },
    };
    expect(outcome).toMatchObject(merged);
    expect(await readResponse(responseId)).toEqual(merged);
  });
});

describe("lockResponseForUpdate (ENG-6869)", () => {
  test("does not lock or update another workspace's response", async () => {
    const { surveyId, responseId } = await seedUnfinishedResponse();
    const other = await seedUnfinishedResponse("Other tenant");

    await expect(
      prisma.$transaction((tx) => lockResponseForUpdate(tx, { responseId, workspaceId: other.workspaceId }))
    ).resolves.toBeNull();
    await expect(
      updateResponseWithQuotaEvaluation({
        responseId,
        workspaceId: other.workspaceId,
        surveyId,
        responseInput: { finished: true, data: { q1: "B" } },
      })
    ).rejects.toThrow(ResourceNotFoundError);
    expect(await readResponse(responseId)).toMatchObject({ finished: false, data: {} });
  });

  test("lets rows that reference the response be inserted while it is locked", async () => {
    // FOR NO KEY UPDATE, not FOR UPDATE: a foreign-key insert takes FOR KEY SHARE on the response, which
    // FOR UPDATE would block for the whole update (quota links, tags and notes written by other requests).
    const { workspaceId, responseId } = await seedUnfinishedResponse();
    const tag = await prisma.tag.create({ data: { name: "ENG-6869 tag", workspaceId } });
    const holder = await holdOpenTransaction((tx) => lockResponseForUpdate(tx, { responseId, workspaceId }));

    try {
      await prisma.$transaction(async (tx) => {
        // Fail fast instead of queueing behind the holder if the lock mode ever blocks the insert.
        await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
        await tx.tagsOnResponses.create({ data: { responseId, tagId: tag.id } });
      });
    } finally {
      holder.commit();
      await holder.committed;
    }

    await expect(prisma.tagsOnResponses.count({ where: { responseId } })).resolves.toBe(1);
  });
});
