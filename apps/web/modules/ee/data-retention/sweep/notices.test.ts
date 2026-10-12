import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import {
  RETENTION_NOTICE_STALE_CLAIM_MS,
  type TRetentionNoticeTarget,
  claimRetentionNotice,
  deleteRetentionNotice,
  markRetentionNoticeDelivered,
} from "./notices";

vi.mock("server-only", () => ({}));

/**
 * Claiming, taking over and delivering notices against a real database (a valid notice left alone, a
 * stale claim taken over, a delivery fenced by its claim token) is proven in
 * `notices.integration.test.ts`. These pin how each statement is built for the two kinds of notice.
 */
const statement = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg11111111111111111111";
const SURVEY: TRetentionNoticeTarget = { organizationId: ORG_ID, entity: "responses", surveyId: "clsrv" };
const MEMBER: TRetentionNoticeTarget = { organizationId: ORG_ID, entity: "members", userId: "clusr" };
const CLAIMED_AT = new Date("2030-01-10T00:00:00.000Z");
const VOID_BEFORE = new Date("2030-01-01T00:00:00.000Z");
const CLOCK_AT = new Date("2029-01-01T00:00:00.000Z");

const client = (rows: unknown = [], affected = 1) => ({
  $queryRaw: vi.fn().mockResolvedValue(rows),
  $executeRaw: vi.fn().mockResolvedValue(affected),
});

describe("claimRetentionNotice", () => {
  test("upserts a survey notice on (surveyId, entity), taking over only a stale claim or a void notice", async () => {
    const tx = client([{ claimToken: "token-1" }]);

    const token = await claimRetentionNotice(tx as never, SURVEY, {
      claimedAt: CLAIMED_AT,
      voidBefore: VOID_BEFORE,
      clockAt: null,
    });

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('ON CONFLICT ("surveyId", "entity") DO UPDATE');
    expect(text).toContain('"claimToken" = EXCLUDED."claimToken", "clockAt" = EXCLUDED."clockAt"');
    expect(text).toContain(
      '("RetentionNotice"."deliveredAt" IS NULL AND "RetentionNotice"."sentAt" < ?) OR ("RetentionNotice"."deliveredAt" IS NOT NULL AND ("RetentionNotice"."sentAt" < ? OR "RetentionNotice"."clockAt" IS DISTINCT FROM ?))'
    );
    const claimToken = values[6];
    expect(values).toEqual([
      expect.any(String),
      ORG_ID,
      "responses",
      "clsrv",
      null,
      CLAIMED_AT,
      claimToken,
      null,
      new Date(CLAIMED_AT.getTime() - RETENTION_NOTICE_STALE_CLAIM_MS),
      VOID_BEFORE,
      null,
    ]);
    // The token handed back is the one the database stored, not the one this call generated.
    expect(token).toBe("token-1");
  });

  test("stores the clock a clock-bound notice was computed for, and replaces one computed for another", async () => {
    const tx = client([{ claimToken: "token-1" }]);

    await claimRetentionNotice(tx as never, MEMBER, {
      claimedAt: CLAIMED_AT,
      voidBefore: VOID_BEFORE,
      clockAt: CLOCK_AT,
    });

    const { values } = statement(tx.$queryRaw.mock.calls[0]);
    // Inserted with the claim, and compared with the stored notice's.
    expect(values[7]).toBe(CLOCK_AT);
    expect(values.at(-1)).toBe(CLOCK_AT);
  });

  test("upserts a member notice on (userId, organizationId, entity), with no survey", async () => {
    const tx = client([]);

    await expect(
      claimRetentionNotice(tx as never, MEMBER, {
        claimedAt: CLAIMED_AT,
        voidBefore: VOID_BEFORE,
        clockAt: CLOCK_AT,
      })
    ).resolves.toBeNull();

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toContain('ON CONFLICT ("userId", "organizationId", "entity") DO UPDATE');
    expect(values.slice(1, 5)).toEqual([ORG_ID, "members", null, "clusr"]);
  });
});

describe("markRetentionNoticeDelivered", () => {
  const delivery = { claimToken: "token-1", deliveredAt: CLAIMED_AT, emailSent: true };

  test("records the delivery only for the claim that sent it, and says whether it did", async () => {
    const tx = client();

    await expect(markRetentionNoticeDelivered(tx as never, SURVEY, delivery)).resolves.toBe(true);

    const { text, values } = statement(tx.$executeRaw.mock.calls[0]);
    expect(text).toContain(
      'WHERE "surveyId" = ? AND "entity" = ?::"RetentionEntity" AND "claimToken" = ? AND "deliveredAt" IS NULL'
    );
    expect(values).toEqual([CLAIMED_AT, true, "clsrv", "responses", "token-1"]);

    tx.$executeRaw.mockResolvedValueOnce(0);
    await expect(markRetentionNoticeDelivered(tx as never, SURVEY, delivery)).resolves.toBe(false);
  });

  test("finds a member's notice by user, organisation and kind", async () => {
    const tx = client();

    await markRetentionNoticeDelivered(tx as never, MEMBER, { ...delivery, emailSent: false });

    const { text, values } = statement(tx.$executeRaw.mock.calls[0]);
    expect(text).toContain('WHERE "userId" = ? AND "organizationId" = ? AND "entity" = \'members\'');
    expect(values).toEqual([CLAIMED_AT, false, "clusr", ORG_ID, "token-1"]);
  });
});

describe("deleteRetentionNotice", () => {
  test("forgets exactly the target's notice", async () => {
    const tx = client();

    await deleteRetentionNotice(tx as never, SURVEY);
    await deleteRetentionNotice(tx as never, MEMBER);

    const [survey, member] = tx.$executeRaw.mock.calls.map(statement);
    expect(survey.text).toBe(
      'DELETE FROM "RetentionNotice" WHERE "surveyId" = ? AND "entity" = ?::"RetentionEntity"'
    );
    expect(survey.values).toEqual(["clsrv", "responses"]);
    expect(member.values).toEqual(["clusr", ORG_ID]);
  });
});
