"use client";

import { FlagIcon, Undo2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TResponseOutcome } from "@formbricks/types/responses";
import { Button } from "@/modules/ui/components/button";
import { useOutcomeAction } from "../hooks/use-outcome-action";
import type { TOutcomeActions } from "../lib/outcome";

interface ResponseOutcomeButtonProps {
  responseId: string;
  outcome: TResponseOutcome | null | undefined;
  workspaceId: string;
  actions: TOutcomeActions;
}

/** "Mark as low quality" on a complete response, "Restore as complete" on a marked one. */
export const ResponseOutcomeButton = ({
  responseId,
  outcome,
  workspaceId,
  actions,
}: Readonly<ResponseOutcomeButtonProps>) => {
  const { t } = useTranslation();
  const { run, isPending } = useOutcomeAction({ workspaceId, actions });
  const isLowQuality = outcome === "lowQuality";

  return (
    <Button
      variant="outline"
      size="sm"
      loading={isPending}
      onClick={() =>
        run([responseId], isLowQuality ? null : "lowQuality", { [responseId]: outcome ?? null })
      }>
      {isLowQuality ? <Undo2Icon /> : <FlagIcon />}
      {isLowQuality
        ? t("workspace.surveys.responses.restore_as_complete")
        : t("workspace.surveys.responses.mark_low_quality")}
    </Button>
  );
};
