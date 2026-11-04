import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResponseAlreadyFinishedError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
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

const seedUnfinishedResponse = async () => {
  const organization = await prisma.organization.create({ data: { name: "ENG-6869 org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-6869 workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "ENG-6869 survey", workspaceId: workspace.id, status: "inProgress" },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, data: {}, finished: false },
  });
  return { surveyId: survey.id, responseId: response.id };
};

/** Writes the row inside a transaction and keeps it open, so the row lock is held until `commit()`. */
const writeInOpenTransaction = async (
  responseId: string,
  data: { finished?: boolean; data: Record<string, string> }
) => {
  let commit!: () => void;
  const commitSignal = new Promise<void>((resolve) => {
    commit = resolve;
  });
  let markWritten!: () => void;
  const written = new Promise<void>((resolve) => {
    markWritten = resolve;
  });

  const committed = prisma.$transaction(
    async (tx) => {
      await tx.response.update({ where: { id: responseId }, data });
      markWritten();
      await commitSignal;
    },
    { timeout: 20_000 }
  );

  await written;
  return { commit, committed };
};

/** Resolves once another backend is waiting on a row lock, i.e. the update under test has reached it. */
const waitForBlockedWriter = async () => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting"
      FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The client update never blocked on the row lock");
};

const readResponse = (responseId: string) =>
  prisma.response.findUniqueOrThrow({
    where: { id: responseId },
    select: { finished: true, data: true },
  });

describe("updateResponseWithQuotaEvaluation with a concurrent write (ENG-6869)", () => {
  test("an update racing the finishing write cannot reopen the response", async () => {
    const { surveyId, responseId } = await seedUnfinishedResponse();
    const finishing = await writeInOpenTransaction(responseId, { finished: true, data: { q1: "A" } });

    const racing = updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: false,
      data: { q1: "B" },
    });
    // Settle the race outcome into a value now, so a rejection is never left unhandled while we wait.
    const outcome = racing.then(
      () => "written",
      (error: unknown) => error
    );
    await waitForBlockedWriter();
    finishing.commit();
    await finishing.committed;

    expect(await outcome).toBeInstanceOf(ResponseAlreadyFinishedError);
    expect(await readResponse(responseId)).toEqual({ finished: true, data: { q1: "A" } });
  });

  test("an update racing the finishing write cannot change the finished answers", async () => {
    const { surveyId, responseId } = await seedUnfinishedResponse();
    const finishing = await writeInOpenTransaction(responseId, { finished: true, data: { q1: "A" } });

    const outcome = updateResponseWithQuotaEvaluation(responseId, surveyId, { data: { q1: "B" } }).then(
      () => "written",
      (error: unknown) => error
    );
    await waitForBlockedWriter();
    finishing.commit();
    await finishing.committed;

    expect(await outcome).toBeInstanceOf(ResponseAlreadyFinishedError);
    expect(await readResponse(responseId)).toEqual({ finished: true, data: { q1: "A" } });
  });

  test("two overlapping updates of an unfinished response keep each other's answers", async () => {
    const { surveyId, responseId } = await seedUnfinishedResponse();
    const first = await writeInOpenTransaction(responseId, { data: { q1: "A" } });

    const second = updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: true,
      data: { q2: "B" },
    });
    await waitForBlockedWriter();
    first.commit();
    await first.committed;

    await expect(second).resolves.toMatchObject({ finished: true, data: { q1: "A", q2: "B" } });
    expect(await readResponse(responseId)).toEqual({ finished: true, data: { q1: "A", q2: "B" } });
  });
});
