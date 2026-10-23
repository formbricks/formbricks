import "server-only";
import { prisma } from "@formbricks/database";
import { getAuthzedClient } from "@/lib/authzed/client";
import { processAuthzedOutboxBatch } from "@/lib/authzed/outbox-processor";
import { getAuthzedOutboxStatus } from "@/lib/authzed/outbox-repository";
import { readAllRelationships } from "@/lib/authzed/relationship-reads";
import { reconcileSurveyRelationships } from "@/lib/authzed/survey";
import { expectedSurveyRelationships, surveyRelationshipsMatch } from "@/lib/authzed/survey-relationships";
import { ONLINE_UPGRADE_RELEASE } from "../compatibility";
import { OnlineUpgradeBlocked } from "./coordinator";

const PAGE_SIZE = 100;
const select = {
  id: true,
  workspaceId: true,
  ownerId: true,
  visibility: true,
  visibilityVersion: true,
} as const;

export const backfillOnlineSurveys = async (assertLock: () => Promise<void>): Promise<void> => {
  let state = await prisma.onlineUpgradeState.findUniqueOrThrow({
    where: { release: ONLINE_UPGRADE_RELEASE },
  });
  if (state.baselineCompletedAt) return;
  for (;;) {
    await assertLock();
    const rows = await prisma.survey.findMany({
      where: state.surveyCursor ? { id: { gt: state.surveyCursor } } : {},
      select: { id: true },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    if (!rows.length) {
      await prisma.onlineUpgradeState.update({
        where: { release: ONLINE_UPGRADE_RELEASE },
        data: { baselineCompletedAt: new Date() },
      });
      return;
    }
    // Failures never advance the cursor. A replay is safe because reconciliation owns the survey lock.
    if ((await reconcileSurveyRelationships(rows.map((row) => row.id))).status !== "projected")
      throw new OnlineUpgradeBlocked("survey_projection_failed", true);
    await assertLock();
    state = await prisma.onlineUpgradeState.update({
      where: { release: ONLINE_UPGRADE_RELEASE },
      data: { surveyCursor: rows.at(-1)!.id, surveyCount: { increment: rows.length } },
    });
  }
};

/** A fresh full scan catches inserts behind the baseline cursor. Outbox delivery covers concurrent writes. */
export const verifyOnlineProjection = async (assertLock: () => Promise<void>): Promise<void> => {
  const state = await prisma.onlineUpgradeState.findUniqueOrThrow({
    where: { release: ONLINE_UPGRADE_RELEASE },
  });
  if (!state.baselineCompletedAt) throw new OnlineUpgradeBlocked("baseline_incomplete", true);
  let cursor: string | undefined;
  for (;;) {
    await assertLock();
    const rows = await prisma.survey.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      select,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    if (!rows.length) break;
    for (const row of rows) {
      await assertLock();
      const { relationships } = await readAllRelationships(getAuthzedClient(), {
        resourceId: row.id,
        resourceType: "survey",
      });
      if (!surveyRelationshipsMatch(relationships, expectedSurveyRelationships(row))) {
        const current = await prisma.survey.findUnique({ where: { id: row.id }, select });
        if (
          current &&
          current.visibilityVersion === row.visibilityVersion &&
          current.ownerId === row.ownerId &&
          current.visibility === row.visibility &&
          current.workspaceId === row.workspaceId
        ) {
          // Repair first, but require a new verification pass before activation.
          await reconcileSurveyRelationships([row.id]);
          throw new OnlineUpgradeBlocked("stable_projection_drift", true);
        }
      }
    }
    cursor = rows.at(-1)!.id;
    await processAuthzedOutboxBatch();
  }
  const outbox = await getAuthzedOutboxStatus();
  if (outbox.deadLettered) throw new OnlineUpgradeBlocked("outbox_dead_letters", true);
  if (outbox.revocationsPastWarning || outbox.overdueRevocations)
    throw new OnlineUpgradeBlocked("revocation_delivery_unhealthy", true);
  // A live installation may always have fresh grants pending. Emptying its entire outbox is not a gate.
};
