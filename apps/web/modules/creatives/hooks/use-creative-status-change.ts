"use client";

import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { type TStatusChangeOutcome, type TSummaryStatus, getStatusChangeOutcome } from "../lib/summary";
import { useUpdateCreative } from "./use-creative-editor";

/**
 * An author's manual status change (the summary's and the editor's status menu, the list's row menu, the
 * editor's Resume), told the same way everywhere: a confirmation when the creative now shows what was
 * picked, or why it doesn't (its survey isn't active, its schedule has ended).
 */
export const useCreativeStatusChange = (creativeId: string) => {
  const { t } = useTranslation();
  const update = useUpdateCreative(creativeId);

  const outcomeMessages: Record<TStatusChangeOutcome["message"], string> = {
    active: t("workspace.creatives.summary.toast_active"),
    scheduled: t("workspace.creatives.summary.toast_scheduled"),
    paused: t("workspace.creatives.summary.toast_paused"),
    closed: t("workspace.creatives.summary.toast_closed"),
    scheduleEnded: t("workspace.creatives.summary.toast_kept_closed"),
    surveyNotActive: t("workspace.creatives.summary.toast_waiting_for_survey"),
    destinationMissing: t("workspace.creatives.status_reason_destination_missing"),
    actionMissing: t("workspace.creatives.status_reason_action_missing"),
  };

  const changeStatus = (status: TSummaryStatus) =>
    update.mutate(
      { status },
      {
        onSuccess: (updated) => {
          const outcome = getStatusChangeOutcome(status, updated);
          if (outcome.kind === "success") toast.success(outcomeMessages[outcome.message]);
          else toast(outcomeMessages[outcome.message], { duration: 6000 });
        },
        onError: (error) =>
          toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))),
      }
    );

  return { changeStatus, isPending: update.isPending };
};
