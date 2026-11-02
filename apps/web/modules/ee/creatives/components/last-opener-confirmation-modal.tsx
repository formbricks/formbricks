"use client";

import { useTranslation } from "react-i18next";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";

interface LastOpenerConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  /** The survey that would be left with nothing that opens it. */
  surveyName: string;
  /** How the change can be undone: it can, so the modal's "cannot be undone" default would be wrong. */
  description: string;
  confirmText: string;
  isConfirming: boolean;
  onConfirm: () => void;
}

/**
 * Asks before a change that leaves a live app survey nothing opens (`surveyLeftUnopenedQuery`):
 * archiving a creative, or saving it with another Destination. The change is allowed either way.
 */
export const LastOpenerConfirmationModal = ({
  open,
  onClose,
  surveyName,
  description,
  confirmText,
  isConfirming,
  onConfirm,
}: Readonly<LastOpenerConfirmationModalProps>) => {
  const { t } = useTranslation();
  return (
    <ConfirmationModal
      open={open}
      setOpen={(value) => {
        if (value === false) onClose();
      }}
      title={t("workspace.creatives.last_opener_title", { survey: surveyName })}
      description={description}
      body={
        <p className="text-sm text-slate-700">
          {t("workspace.creatives.last_opener_warning", { survey: surveyName })}
        </p>
      }
      buttonText={confirmText}
      buttonVariant="default"
      buttonLoading={isConfirming}
      onConfirm={onConfirm}
    />
  );
};
