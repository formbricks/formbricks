import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { loadNoticeOrganization } from "./due-targets";
import { claimRetentionNotice, markRetentionNoticeDelivered } from "./notices";
import type { TNoticeRecipient } from "./recipients";
import { recordRetentionRunActions } from "./run";
import { type TNoticeFormat, type TSurveyNoticeItem, sendSurveyNotices } from "./survey-notices";
import type { TRetentionSweepContext } from "./sweep";
import {
  RetentionPolicyChangedError,
  lockUnchangedRetentionPolicy,
  readDatabaseClock,
  runSweepTransaction,
} from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/email", () => ({ sendSurveyRetentionNoticeEmail: vi.fn() }));
vi.mock("./due-targets", () => ({ loadNoticeOrganization: vi.fn() }));
vi.mock("./notices", () => ({ claimRetentionNotice: vi.fn(), markRetentionNoticeDelivered: vi.fn() }));
vi.mock("./run", () => ({ recordRetentionRunActions: vi.fn() }));
// Small budgets, so a test can cap and chunk the claims with a handful of surveys.
vi.mock("./constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./constants")>()),
  RETENTION_SWEEP_BATCH_SIZE: 2,
  RETENTION_NOTICES_PER_RUN: 3,
}));
vi.mock("./transaction", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./transaction")>()),
  runSweepTransaction: vi.fn(),
  lockUnchangedRetentionPolicy: vi.fn(),
  readDatabaseClock: vi.fn(),
}));

/**
 * Notices against a real database (one email per person across the responses and surveys batches, no
 * SMTP recorded with no recipient, a failed send leaving the claims undelivered) are proven in
 * `sweep.integration.test.ts`. These pin how claims are capped and grouped, and what each outcome records.
 */
const NOW = new Date("2030-01-10T01:00:00.000Z");
const TX = { tx: true };

const context = (entity: "surveys" | "responses"): TRetentionSweepContext =>
  ({
    runId: `run-${entity}`,
    now: NOW,
    deadline: NOW.getTime() + 60_000,
    resumeAfter: null,
    restartedWarning: null,
    policy: {
      id: `pol-${entity}`,
      organizationId: "clorg",
      entity,
      enabledAt: NOW,
      warnDays: 7,
      periodDays: 30,
      conditions: [],
    },
  }) as TRetentionSweepContext;

const person = (userId: string, locale: TNoticeRecipient["locale"] = "en-US"): TNoticeRecipient => ({
  userId,
  email: `${userId}@example.com`,
  name: userId,
  locale,
});

const voidBefore = new Date("2030-01-01T00:00:00.000Z");
const clockAt = new Date("2029-01-01T00:00:00.000Z");
const surveysItem = (id: string, recipient: TNoticeRecipient): TSurveyNoticeItem<"surveys"> => ({
  survey: { id, name: `Survey ${id}`, workspaceId: "clwsp" },
  recipient,
  voidBefore,
  clockAt,
  describe: (format, url) => ({
    name: `Survey ${id}`,
    url,
    archiveDate: format.date(NOW),
    deleteDate: format.date(NOW),
  }),
});
const responsesItem = (id: string, recipient: TNoticeRecipient): TSurveyNoticeItem<"responses"> => ({
  survey: { id, name: `Survey ${id}`, workspaceId: "clwsp" },
  recipient,
  voidBefore,
  clockAt: null,
  describe: (format, url) => ({ name: `Survey ${id}`, url, count: format.number(12345), deleteDate: "-" }),
});

const surveysBatch = (items: TSurveyNoticeItem<"surveys">[]) => ({
  context: context("surveys"),
  entity: "surveys" as const,
  items,
});
const responsesBatch = (items: TSurveyNoticeItem<"responses">[]) => ({
  context: context("responses"),
  entity: "responses" as const,
  items,
});

const deadline = () => Date.now() + 60_000;
const claimedSurveyIds = () =>
  vi
    .mocked(claimRetentionNotice)
    .mock.calls.map(([, target]) => ("surveyId" in target ? target.surveyId : ""));

describe("sendSurveyNotices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(runSweepTransaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn(TX)) as never);
    vi.mocked(readDatabaseClock).mockResolvedValue(NOW);
    vi.mocked(claimRetentionNotice).mockImplementation(async (_tx, target) =>
      "surveyId" in target ? `token-${target.surveyId}` : null
    );
    vi.mocked(markRetentionNoticeDelivered).mockResolvedValue(true);
    vi.mocked(sendSurveyRetentionNoticeEmail).mockResolvedValue(true);
    vi.mocked(loadNoticeOrganization).mockResolvedValue({ name: "Acme", timeZone: "Europe/Lisbon" });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("refuses notices of another organisation than the one it sends for", async () => {
    await expect(
      sendSurveyNotices("clother", [surveysBatch([surveysItem("s1", person("alice"))])], deadline())
    ).rejects.toThrow("Survey notices of another organisation");
    expect(claimRetentionNotice).not.toHaveBeenCalled();
  });

  test("sends one email per person, listing both their archives and their response deletions", async () => {
    const alice = person("alice", "de-DE");
    const bob = person("bob");

    await sendSurveyNotices(
      "clorg",
      [
        responsesBatch([responsesItem("r1", alice)]),
        surveysBatch([surveysItem("s1", alice), surveysItem("s2", bob)]),
      ],
      deadline()
    );

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledTimes(2);
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith({
      email: "alice@example.com",
      locale: "de-DE",
      organizationId: "clorg",
      organizationName: "Acme",
      archivedSurveys: [
        expect.objectContaining({
          name: "Survey s1",
          url: expect.stringMatching(/\/workspaces\/clwsp\/surveys\/s1\/summary$/),
        }),
      ],
      // Counts in the reader's own number format.
      responseDeletions: [expect.objectContaining({ name: "Survey r1", count: "12.345" })],
    });
    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "bob@example.com", responseDeletions: [] })
    );
    // Each delivery's History row lands on its own policy's run, naming who was emailed.
    expect(recordRetentionRunActions).toHaveBeenCalledWith(TX, "run-responses", [
      {
        targetType: "survey",
        targetId: "r1",
        targetName: "Survey r1",
        action: "notified",
        recipient: "alice@example.com",
      },
    ]);
    expect(recordRetentionRunActions).toHaveBeenCalledWith(TX, "run-surveys", [
      expect.objectContaining({ targetId: "s1", recipient: "alice@example.com" }),
    ]);
    expect(markRetentionNoticeDelivered).toHaveBeenCalledWith(
      TX,
      { organizationId: "clorg", entity: "responses", surveyId: "r1" },
      { claimToken: "token-r1", deliveredAt: NOW, emailSent: true }
    );
  });

  test("states dates in the reader's locale and the organisation's time zone", async () => {
    let format: TNoticeFormat | undefined;
    const item: TSurveyNoticeItem<"surveys"> = {
      ...surveysItem("s1", person("alice", "en-US")),
      describe: (given, url) => {
        format = given;
        return { name: "s1", url, archiveDate: "", deleteDate: "" };
      },
    };
    vi.mocked(loadNoticeOrganization).mockResolvedValue({ name: "Acme", timeZone: "Pacific/Auckland" });

    await sendSurveyNotices("clorg", [surveysBatch([item])], deadline());

    // Noon UTC on 10 January is already 11 January in Auckland: the organisation's zone, not the server's.
    expect(format?.date(new Date("2030-01-10T12:00:00.000Z"))).toBe("Jan 11, 2030");
    expect(format?.number(1000)).toBe("1,000");
  });

  test("claims each policy's notices under its unchanged-lock, a batch per transaction, up to the run's cap", async () => {
    const alice = person("alice");
    const items = ["s1", "s2", "s3", "s4", "s5"].map((id) => surveysItem(id, alice));

    await sendSurveyNotices("clorg", [surveysBatch(items)], deadline());

    expect(claimedSurveyIds()).toEqual(["s1", "s2", "s3"]);
    expect(lockUnchangedRetentionPolicy).toHaveBeenCalledTimes(2);
    expect(lockUnchangedRetentionPolicy).toHaveBeenCalledWith(TX, context("surveys").policy);
    expect(claimRetentionNotice).toHaveBeenCalledWith(
      TX,
      { organizationId: "clorg", entity: "surveys", surveyId: "s1" },
      { claimedAt: NOW, voidBefore, clockAt }
    );
  });

  test("leaves out a notice that is still valid or claimed by another sweep, and sends nothing when none is left", async () => {
    vi.mocked(claimRetentionNotice).mockResolvedValue(null);

    await expect(
      sendSurveyNotices("clorg", [surveysBatch([surveysItem("s1", person("alice"))])], deadline())
    ).resolves.toEqual({ changed: [] });

    expect(loadNoticeOrganization).not.toHaveBeenCalled();
    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
  });

  test("skips only the notices of a policy changed since its run read it, and reports it", async () => {
    vi.mocked(lockUnchangedRetentionPolicy).mockImplementation(async (_tx, snapshot) => {
      if (snapshot.entity === "responses") throw new RetentionPolicyChangedError("responses");
    });
    const alice = person("alice");

    await expect(
      sendSurveyNotices(
        "clorg",
        [responsesBatch([responsesItem("r1", alice)]), surveysBatch([surveysItem("s1", alice)])],
        deadline()
      )
    ).resolves.toEqual({ changed: ["responses"] });

    expect(sendSurveyRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ archivedSurveys: [expect.anything()], responseDeletions: [] })
    );
    expect(logger.info).toHaveBeenCalledWith(
      { runId: "run-responses" },
      "Data retention policy changed before its notices; skipped"
    );
  });

  test("lets any other claim failure through", async () => {
    const failure = new Error("statement timeout");
    vi.mocked(claimRetentionNotice).mockRejectedValue(failure);

    await expect(
      sendSurveyNotices("clorg", [surveysBatch([surveysItem("s1", person("alice"))])], deadline())
    ).rejects.toBe(failure);
  });

  test("records the notices without a recipient when there is no SMTP", async () => {
    vi.mocked(sendSurveyRetentionNoticeEmail).mockResolvedValue(false);

    await sendSurveyNotices("clorg", [surveysBatch([surveysItem("s1", person("alice"))])], deadline());

    expect(markRetentionNoticeDelivered).toHaveBeenCalledWith(TX, expect.anything(), {
      claimToken: "token-s1",
      deliveredAt: NOW,
      emailSent: false,
    });
    expect(recordRetentionRunActions).toHaveBeenCalledWith(TX, "run-surveys", [
      expect.objectContaining({ targetId: "s1", recipient: null }),
    ]);
  });

  test("leaves a failed email's claims undelivered and carries on with the next person", async () => {
    vi.mocked(sendSurveyRetentionNoticeEmail)
      .mockRejectedValueOnce(new Error("SMTP 451"))
      .mockResolvedValueOnce(true);

    await sendSurveyNotices(
      "clorg",
      [surveysBatch([surveysItem("s1", person("alice")), surveysItem("s2", person("bob"))])],
      deadline()
    );

    expect(vi.mocked(markRetentionNoticeDelivered).mock.calls.map(([, target]) => target)).toEqual([
      { organizationId: "clorg", entity: "surveys", surveyId: "s2" },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyCount: 1 }),
      "Data retention notice email failed; the notices stay unsent"
    );
  });

  test("records no History row for a claim that was taken over before it was delivered", async () => {
    vi.mocked(markRetentionNoticeDelivered).mockResolvedValue(false);

    await sendSurveyNotices("clorg", [surveysBatch([surveysItem("s1", person("alice"))])], deadline());

    expect(recordRetentionRunActions).not.toHaveBeenCalled();
  });

  test("starts no claim batch and no email past the deadline", async () => {
    const alice = person("alice");
    const bob = person("bob");
    const end = Date.now() + 1000;
    // The first batch's claims run out the clock: the second batch isn't claimed, and nobody is emailed.
    vi.mocked(claimRetentionNotice).mockImplementation(async (_tx, target) => {
      vi.setSystemTime(end);
      return "surveyId" in target ? `token-${target.surveyId}` : null;
    });

    await sendSurveyNotices(
      "clorg",
      [surveysBatch([surveysItem("s1", alice), surveysItem("s2", bob), surveysItem("s3", bob)])],
      end
    );

    expect(claimedSurveyIds()).toEqual(["s1", "s2"]);
    expect(sendSurveyRetentionNoticeEmail).not.toHaveBeenCalled();
  });
});
