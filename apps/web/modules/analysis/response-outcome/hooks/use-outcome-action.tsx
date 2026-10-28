"use client";

import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TResponseOutcome } from "@formbricks/types/responses";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { OutcomeBatchError } from "../lib/client";
import type { TOutcomeActions, TOutcomeChanges } from "../lib/outcome";
import { useSetResponsesOutcome } from "./use-set-responses-outcome";

/** The mutation plus its toasts, so the card and the selection bar report the same way. */
export const useOutcomeAction = ({
  workspaceId,
  actions,
}: {
  workspaceId: string;
  actions: TOutcomeActions;
}) => {
  const { t } = useTranslation();
  const mutation = useSetResponsesOutcome({
    workspaceId,
    applyOutcomes: actions.applyOutcomes,
    onSaved: ({ updated }, { ids, outcome }) => {
      actions.onSaved(ids, outcome);
      toast.success(
        outcome === "lowQuality" ? (
          <span className="flex flex-col">
            <span className="font-semibold">
              {t("workspace.surveys.responses.marked_low_quality", { count: updated })}
            </span>
            <span className="text-slate-500">
              {t("workspace.surveys.responses.marked_low_quality_description")}
            </span>
          </span>
        ) : (
          t("workspace.surveys.responses.restored_as_complete", { count: updated })
        )
      );
    },
    onFailed: (error, { outcome }) => {
      const cause = error instanceof OutcomeBatchError ? error.cause : error;
      const savedSome = error instanceof OutcomeBatchError && error.doneIds.length > 0;
      if (savedSome) actions.onSaved(error.doneIds, outcome);
      // Part-saved runs say so: the server's reason alone would read as if nothing had changed.
      toast.error(
        savedSome
          ? t("workspace.surveys.responses.outcome_update_partly_failed")
          : getV3ApiErrorMessage(cause, t("workspace.surveys.responses.outcome_update_failed"))
      );
    },
  });

  const run = (ids: string[], outcome: TResponseOutcome | null, previous: TOutcomeChanges) =>
    mutation.mutate({ ids, outcome, previous });

  return { run, isPending: mutation.isPending };
};
