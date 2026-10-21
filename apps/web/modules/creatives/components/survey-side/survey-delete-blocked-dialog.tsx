"use client";

import { LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { getCreativesPath } from "@/modules/creatives/lib/paths";
import { VisibilityBlockersAlert } from "@/modules/survey/visibility/components/visibility-blockers-alert";
import type { TSurveyVisibilityBlocker } from "@/modules/survey/visibility/types";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";

interface SurveyDeleteBlockedDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  workspaceId: string;
  /** The creatives the server named when it refused the delete. */
  blockers: readonly TSurveyVisibilityBlocker[];
}

/**
 * Why a survey can't be deleted: non-archived creatives open it. Lists them with the visibility
 * blockers UI the Restrict dialog uses; relinking, archiving or deleting them clears the block.
 */
export const SurveyDeleteBlockedDialog = ({
  open,
  setOpen,
  workspaceId,
  blockers,
}: Readonly<SurveyDeleteBlockedDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ConfirmationModal
      open={open}
      setOpen={setOpen}
      Icon={LinkIcon}
      title={t("workspace.creatives.survey_side.delete_blocked_title")}
      description={t("workspace.creatives.survey_side.delete_blocked_description")}
      body={
        <VisibilityBlockersAlert
          blockers={blockers}
          title={t("workspace.creatives.survey_side.delete_blocked_list_title")}
          className="whitespace-normal"
        />
      }
      buttonText={t("workspace.creatives.survey_side.go_to_creatives")}
      buttonVariant="default"
      cancelButtonText={t("common.close")}
      onConfirm={() => router.push(getCreativesPath(workspaceId))}
    />
  );
};
