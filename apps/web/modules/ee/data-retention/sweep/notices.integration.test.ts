import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  RETENTION_NOTICE_STALE_CLAIM_MS,
  claimRetentionNotice,
  markRetentionNoticeDelivered,
} from "./notices";

const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

describe("retention notice claims (real Postgres)", () => {
  let target: { organizationId: string; entity: "surveys"; surveyId: string };

  const claim = (claimedAt = new Date(), voidBefore = ago(1000 * HOUR)) =>
    prisma.$transaction((tx) => claimRetentionNotice(tx, target, { claimedAt, voidBefore }));
  const deliver = (claimToken: string, emailSent = true) =>
    prisma.$transaction((tx) =>
      markRetentionNoticeDelivered(tx, target, { claimToken, deliveredAt: new Date(), emailSent })
    );

  beforeEach(async () => {
    await resetDb();
    const organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    const workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    const surveyId = (await prisma.survey.create({ data: { name: "Site visit", workspaceId } })).id;
    target = { organizationId, entity: "surveys", surveyId };
  });

  test("a fresh claim in flight blocks a second one", async () => {
    await expect(claim()).resolves.toEqual(expect.any(String));
    await expect(claim()).resolves.toBeNull();
  });

  test("a stale undelivered claim is taken over, and the old token can no longer deliver it", async () => {
    const first = (await claim(ago(RETENTION_NOTICE_STALE_CLAIM_MS + HOUR)))!;
    const second = await claim();

    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe(first);
    await expect(deliver(first)).resolves.toBe(false);
    await expect(deliver(second!)).resolves.toBe(true);
    // Delivered once only.
    await expect(deliver(second!)).resolves.toBe(false);
  });

  test("a delivered notice stays until it is void, then is replaced", async () => {
    const token = (await claim(ago(10 * HOUR)))!;
    await deliver(token);

    await expect(claim(new Date(), ago(20 * HOUR))).resolves.toBeNull();
    const replaced = await claim(new Date(), ago(5 * HOUR));

    expect(replaced).toEqual(expect.any(String));
    expect(
      await prisma.retentionNotice.findUniqueOrThrow({
        where: { surveyId_entity: { surveyId: target.surveyId, entity: "surveys" } },
      })
    ).toMatchObject({ deliveredAt: null, emailSent: false, claimToken: replaced });
  });
});
