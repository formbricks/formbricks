"use client";

import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
// Use navigation, not router
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SummaryInconsistentResponseDataAlertProps {
  responsesBeforeLastEdit: boolean;
  environmentId: string;
  surveyId: string;
}

export function SummaryInconsistentResponseDataAlert({
  responsesBeforeLastEdit,
  environmentId,
  surveyId,
}: SummaryInconsistentResponseDataAlertProps) {
  const router = useRouter();
  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);
  const { t } = useTranslate();

  if (!responsesBeforeLastEdit) return null;

  const handleAlertButtonClick = () => {
    setIsCautionDialogOpen(true);
  };

  return (
    <>
      <Alert variant="info" size="small" className="w-fit">
        <AlertTitle>
          {t("environments.surveys.summary.response_inconsistencies_edited_while_public")}
        </AlertTitle>
        <AlertButton onClick={handleAlertButtonClick}>{t("common.learn_more")}</AlertButton>
      </Alert>

      <AlertDialog
        headerText={t("environments.surveys.summary.response_inconsistencies_missing_responses_dont_worry")}
        open={isCautionDialogOpen}
        setOpen={setIsCautionDialogOpen}
        mainText={
          <>
            <p className="mt-3">
              {t("environments.surveys.summary.response_inconsistencies_available_as_download")}
            </p>
            <p className="mt-3">{t("environments.surveys.summary.response_inconsistencies_explanation")}</p>
          </>
        }
        confirmBtnLabel={t("common.close")}
        declineBtnLabel={t("common.download")}
        declineBtnVariant="outline"
        onConfirm={() => {
          setIsCautionDialogOpen(false);
        }}
        onDecline={() => {
          // Add download functionality here
          // For now just close the dialog
          setIsCautionDialogOpen(false);
        }}
      />
    </>
  );
}

export default SummaryInconsistentResponseDataAlert;
