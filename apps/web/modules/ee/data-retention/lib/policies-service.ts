import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import type { TRetentionPolicyKind, TRetentionPolicySettings } from "../types";
import {
  RETENTION_POLICY_DEFAULTS,
  type TRetentionPolicyIssue,
  getRetentionPolicyEnabledAt,
  getRetentionPolicyIssues,
  isSameRetentionPolicy,
} from "./policy-rules";

export type TRetentionPolicyRow = TRetentionPolicySettings & {
  id: string;
  entity: TRetentionPolicyKind;
  enabledAt: Date | null;
};

const POLICY_SELECT = {
  id: true,
  entity: true,
  enabled: true,
  enabledAt: true,
  warnDays: true,
  archiveDays: true,
  deleteDays: true,
  conditions: true,
} as const;

const toSettings = (row: TRetentionPolicySettings): TRetentionPolicySettings => ({
  enabled: row.enabled,
  warnDays: row.warnDays,
  archiveDays: row.archiveDays,
  deleteDays: row.deleteDays,
  conditions: [...row.conditions],
});

/** The organisation's saved policies; a policy never saved has no row. */
export const getRetentionPolicyRows = (organizationId: string): Promise<TRetentionPolicyRow[]> =>
  prisma.retentionPolicy.findMany({ where: { organizationId }, select: POLICY_SELECT });

/** Each policy's settings, saved or default. */
export const resolveRetentionPolicySettings = (
  rows: ReadonlyArray<Pick<TRetentionPolicyRow, "entity"> & TRetentionPolicySettings>
): Record<TRetentionPolicyKind, TRetentionPolicySettings> => {
  const saved = new Map(rows.map((row) => [row.entity, row]));
  const settingsFor = (policy: TRetentionPolicyKind) =>
    toSettings(saved.get(policy) ?? RETENTION_POLICY_DEFAULTS[policy]);
  return {
    responses: settingsFor("responses"),
    surveys: settingsFor("surveys"),
    members: settingsFor("members"),
  };
};

/** The merged policy breaks a business rule. Nothing was written. */
export class RetentionPolicyInvalidError extends Error {
  constructor(readonly issues: TRetentionPolicyIssue[]) {
    super("The retention policy is not valid.");
    this.name = "RetentionPolicyInvalidError";
  }
}

export type TRetentionPolicyUpdate = {
  id: string;
  /** What the policy was before: its saved settings, or its defaults if it was never saved. */
  previous: TRetentionPolicySettings;
  next: TRetentionPolicySettings;
  /** False when the patch left the policy as it was, so there is nothing to audit. */
  changed: boolean;
};

/**
 * Apply a partial change to one policy. The patch is merged over the saved settings, or the defaults,
 * and the result must meet every rule (`getRetentionPolicyIssues`) or nothing is written.
 *
 * Writers to the same policy are serialised on its row, so two edits can't both read the old settings
 * and lose one change, or compute `enabledAt` from a state that is already gone. A never-saved policy
 * gets its row first (`ON CONFLICT DO NOTHING`, so a concurrent first save waits on the same row).
 */
export async function updateRetentionPolicy({
  organizationId,
  policy,
  patch,
  updatedById,
  now,
}: {
  organizationId: string;
  policy: TRetentionPolicyKind;
  patch: Partial<TRetentionPolicySettings>;
  updatedById: string;
  now: Date;
}): Promise<TRetentionPolicyUpdate> {
  return prisma.$transaction(async (tx) => {
    const defaults = RETENTION_POLICY_DEFAULTS[policy];
    const inserted = await tx.$executeRaw`
      INSERT INTO "RetentionPolicy" ("id", "organizationId", "entity", "warnDays", "archiveDays", "deleteDays", "updated_at")
      VALUES (${createId()}, ${organizationId}, ${policy}::"RetentionEntity", ${defaults.warnDays},
              ${defaults.archiveDays}, ${defaults.deleteDays}, ${now})
      ON CONFLICT ("organizationId", "entity") DO NOTHING
    `;
    // Lock the row, then read it through Prisma: raw SQL would hand the enum array back unparsed.
    await tx.$queryRaw`
      SELECT 1 FROM "RetentionPolicy"
      WHERE "organizationId" = ${organizationId} AND "entity" = ${policy}::"RetentionEntity"
      FOR UPDATE
    `;
    const locked = await tx.retentionPolicy.findUniqueOrThrow({
      where: { organizationId_entity: { organizationId, entity: policy } },
      select: POLICY_SELECT,
    });

    const previous = inserted === 1 ? toSettings(defaults) : toSettings(locked);
    const next: TRetentionPolicySettings = { ...previous, ...patch };
    const issues = getRetentionPolicyIssues(policy, next);
    // Throwing rolls back the row a first save just created.
    if (issues.length > 0) throw new RetentionPolicyInvalidError(issues);

    const changed = !isSameRetentionPolicy(previous, next);
    // A new row holds placeholder settings until written, so it is written even when nothing changed.
    if (changed || inserted === 1) {
      await tx.retentionPolicy.update({
        where: { id: locked.id },
        data: {
          ...next,
          enabledAt: getRetentionPolicyEnabledAt(
            inserted === 1 ? null : { ...previous, enabledAt: locked.enabledAt },
            next,
            now
          ),
          updatedById,
        },
      });
    }

    return { id: locked.id, previous, next, changed };
  });
}
