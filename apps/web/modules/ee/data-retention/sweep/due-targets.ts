import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { getReportingTimeZone } from "@/lib/date-ranges";
import type { TRetentionStep } from "../lib/schedule";
import {
  RETENTION_ACTIONS_PER_RUN,
  RETENTION_NOTICES_PER_RUN,
  RETENTION_SWEEP_BATCH_SIZE,
} from "./constants";
import type { TRetentionRunSkip } from "./run";
import type { TNoticeOrganization } from "./survey-notices";
import type { TRetentionSweepContext } from "./sweep";
import { runSweepTransaction } from "./transaction";

/**
 * Walk a policy's candidates page by page, each page read in a bounded sweep transaction, and sort them
 * by the step their schedule says is due. Stops at the run's deadline, or once both lists are full
 * (`RETENTION_NOTICES_PER_RUN`, `RETENTION_ACTIONS_PER_RUN`): the rest are still due tomorrow, since
 * candidates are always `<=`. Reading everything first and acting after keeps notices from being
 * starved by a night's deletions, and every action re-checks its target under lock anyway.
 */
export const collectDueTargets = async <TTarget>(
  context: TRetentionSweepContext,
  {
    readPage,
    keyOf,
    stepOf,
  }: {
    readPage: (tx: Prisma.TransactionClient, afterKey: string | undefined) => Promise<TTarget[]>;
    keyOf: (target: TTarget) => string;
    stepOf: (target: TTarget) => TRetentionStep | null;
  }
): Promise<{ notify: TTarget[]; act: TTarget[] }> => {
  const notify: TTarget[] = [];
  const act: TTarget[] = [];
  let afterKey: string | undefined;
  while (
    Date.now() < context.deadline &&
    (notify.length < RETENTION_NOTICES_PER_RUN || act.length < RETENTION_ACTIONS_PER_RUN)
  ) {
    const page = await runSweepTransaction((tx) => readPage(tx, afterKey));
    for (const target of page) {
      const step = stepOf(target);
      if (step === "notify" && notify.length < RETENTION_NOTICES_PER_RUN) notify.push(target);
      if (step === "act" && act.length < RETENTION_ACTIONS_PER_RUN) act.push(target);
    }
    if (page.length < RETENTION_SWEEP_BATCH_SIZE) break;
    afterKey = keyOf(page[page.length - 1]);
  }
  return { notify, act };
};

/** The organisation's name and reporting time zone, as its notices state dates. */
export const loadNoticeOrganization = async (organizationId: string): Promise<TNoticeOrganization> => {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, displayTimeZone: true },
  });
  return { name: organization.name, timeZone: getReportingTimeZone(organization.displayTimeZone) };
};

/** Surveys skipped as held by an exemption, and as having nobody to tell. */
export const surveySkips = (
  held: readonly { id: string; name: string }[],
  noRecipient: readonly { id: string; name: string }[]
): TRetentionRunSkip[] => [
  ...held.map((survey) => ({
    targetType: "survey" as const,
    targetId: survey.id,
    targetName: survey.name,
    skipReason: "exempt" as const,
  })),
  ...noRecipient.map((survey) => ({
    targetType: "survey" as const,
    targetId: survey.id,
    targetName: survey.name,
    skipReason: "noRecipient" as const,
  })),
];

/** The latest of the given dates: what a notice must be claimed at or after to count. */
export const latestOf = (...dates: (Date | null)[]): Date =>
  dates.filter((date): date is Date => date !== null).reduce((a, b) => (a > b ? a : b));
