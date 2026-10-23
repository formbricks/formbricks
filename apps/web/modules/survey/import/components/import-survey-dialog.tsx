"use client";

import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { ImportSurveyForm } from "@/modules/survey/import/components/import-survey-form";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";

type ImportSurveyDialogProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Import a Qualtrics survey (.qsf): the dialog shell around `ImportSurveyForm`, as Create with AI's. */
export const ImportSurveyDialog = ({
  workspaceId,
  isAIAvailable,
  aiUnavailableReason,
  trigger,
  open,
  onOpenChange,
}: Readonly<ImportSurveyDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isNavigating, startEditorNavigationTransition] = useTransition();
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const commitOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const setDialogOpen = (nextOpen: boolean) => {
    if (isNavigating && !nextOpen) return;

    // Closing throws away a running import or a draft nobody opened, so it asks first.
    if (!nextOpen && hasUnsavedWork) {
      setIsConfirmingDiscard(true);
      return;
    }

    commitOpenChange(nextOpen);
  };

  const handleSuccess = (surveyId: string) => {
    startEditorNavigationTransition(() => {
      router.push(`/workspaces/${workspaceId}/surveys/${surveyId}/edit`);
    });
  };

  // Plain calls, not inside the ternary below: the translation scanner only sees `t("literal")`.
  const discardImportTitle = t("workspace.surveys.import.discard_import_title");
  const discardDraftTitle = t("workspace.surveys.import.discard_draft_title");
  const discardImportBody = t("workspace.surveys.import.discard_import_body");
  const discardDraftBody = t("workspace.surveys.import.discard_draft_body");

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        width="default"
        className="overflow-hidden"
        // A stray click outside must not kill an import, but Escape still closes (with the confirm).
        disableCloseOnOutsideClick
        closeOnEscape>
        <DialogHeader>
          <UploadIcon aria-hidden="true" />
          <DialogTitle>{t("workspace.surveys.import.dialog_title")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.import.dialog_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody unconstrained className="-mx-1 -mt-1 flex flex-none flex-col px-1 pt-1 pb-1">
          <ImportSurveyForm
            workspaceId={workspaceId}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
            onSuccess={handleSuccess}
            onCancel={() => setDialogOpen(false)}
            renderFooter={(footer) => <DialogFooter>{footer}</DialogFooter>}
            isHostNavigating={isNavigating}
            onUnsavedWorkChange={setHasUnsavedWork}
            onImportingChange={setIsImporting}
          />
        </DialogBody>
      </DialogContent>

      <ConfirmationModal
        open={isConfirmingDiscard}
        setOpen={setIsConfirmingDiscard}
        title={isImporting ? discardImportTitle : discardDraftTitle}
        body={isImporting ? discardImportBody : discardDraftBody}
        buttonText={t("workspace.surveys.ai_create.discard")}
        buttonVariant="destructive"
        cancelButtonText={t("workspace.surveys.ai_create.keep_editing")}
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          setHasUnsavedWork(false);
          commitOpenChange(false);
        }}
      />
    </Dialog>
  );
};
