import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface EditPublicSurveyAlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  isLoading?: boolean;
  primaryButtonAction?: () => Promise<void>;
  secondaryButtonAction?: () => void;
  primaryButtonText?: string;
  secondaryButtonText?: string;
}

export const EditPublicSurveyAlertDialog = ({
  open,
  setOpen,
  isLoading = false,
  primaryButtonAction,
  secondaryButtonAction,
  primaryButtonText,
  secondaryButtonText,
}: EditPublicSurveyAlertDialogProps) => {
  const { t } = useTranslation();
  // Track which action is running so the spinner shows on the clicked button,
  // regardless of whether the async action is the primary or secondary one.
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const actions = [] as Array<{
    label?: string;
    onClick: () => void | Promise<void>;
    variant: React.ComponentProps<typeof Button>["variant"];
  }>;
  if (secondaryButtonAction) {
    actions.push({
      label: secondaryButtonText,
      onClick: secondaryButtonAction,
      variant: "secondary",
    });
  }
  if (primaryButtonAction) {
    actions.push({
      label: primaryButtonText,
      onClick: primaryButtonAction,
      variant: "default",
    });
  }
  if (actions.length === 0) {
    actions.push({
      label: secondaryButtonText ?? t("common.close"),
      onClick: () => setOpen(false),
      variant: "default",
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t("workspace.surveys.edit.caution_edit_published_survey")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.edit.caution_recommendation")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p>{t("workspace.surveys.edit.caution_explanation_intro")}</p>
          <ul className="mt-3 list-disc space-y-0.5 pl-5">
            <li>{t("workspace.surveys.edit.caution_explanation_responses_are_safe")}</li>
            <li>{t("workspace.surveys.edit.caution_explanation_new_responses_separated")}</li>
            <li>{t("workspace.surveys.edit.caution_explanation_only_new_responses_in_summary")}</li>
          </ul>
        </DialogBody>

        <DialogFooter>
          {actions.map(({ label, onClick, variant }) => (
            <Button
              key={label}
              variant={variant}
              loading={isLoading && pendingLabel === label}
              disabled={isLoading && pendingLabel !== label}
              onClick={() => {
                setPendingLabel(label ?? null);
                void onClick();
              }}>
              {label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
