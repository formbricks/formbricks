import type { TFunction } from "i18next";
import type { TRetentionPolicyKind, TRetentionRun } from "../types";

export const getRetentionPolicyLabel = (policy: TRetentionPolicyKind, t: TFunction): string => {
  switch (policy) {
    case "responses":
      return t("common.responses");
    case "surveys":
      return t("common.surveys");
    case "members":
      return t("common.members");
  }
};

/**
 * The counts History shows for a run, per the mock: `null` where the policy has no such step, shown
 * as "—" rather than a misleading 0. Responses send no notices and have no archive; only surveys are
 * archived; for members the last column counts deactivations, which the API reports as `archived`.
 */
export const getRetentionHistoryCounts = (
  run: TRetentionRun
): { notified: number | null; archived: number | null; deletedOrDeactivated: number } => ({
  notified: run.policy === "responses" ? null : run.notified,
  archived: run.policy === "surveys" ? run.archived : null,
  deletedOrDeactivated: run.policy === "members" ? run.archived : run.deleted,
});
