"use client";

import { useState } from "react";
import { Alert, AlertTitle, AlertButton } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { useRouter } from "next/navigation"; // Use navigation, not router
import { useTranslate } from "@tolgee/react";


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
  
  if (!responsesBeforeLastEdit) 
    return null;

  const handleAlertButtonClick = () => {
    setIsCautionDialogOpen(true);
  };
  
  return (
    <>
      <Alert variant="info" size="small" className="w-fit">
        <AlertTitle>{t("environments.surveys.summary.inconsistent_response_data")}</AlertTitle>
        <AlertButton onClick={handleAlertButtonClick}>{t("common.learn_more")}</AlertButton>
      </Alert>

      <AlertDialog
        headerText={t("environments.surveys.edit.caution_edit_published_survey")}
        open={isCautionDialogOpen}
        setOpen={setIsCautionDialogOpen}
        mainText={
          <>
            <p>{t("environments.surveys.edit.caution_recommendation")}</p>
            <p className="mt-3">{t("environments.surveys.summary.response_inconsistensies_title")}</p>
            <p className="mt-3">{t("environments.surveys.summary.response_inconsistensies_available_as_download")}</p>
          </>
        }
        confirmBtnLabel={t("common.ok")}
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