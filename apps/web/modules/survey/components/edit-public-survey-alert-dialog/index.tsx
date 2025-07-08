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
import { useTranslate } from "@tolgee/react";

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
  const { t } = useTranslate();
  const actions = [] as Array<{
    label?: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    variant: React.ComponentProps<typeof Button>["variant"];
  }>;
  if (secondaryButtonAction) {
    actions.push({
      label: secondaryButtonText,
      onClick: secondaryButtonAction,
      disabled: isLoading,
      variant: "secondary",
    });
  }
  if (primaryButtonAction) {
    actions.push({
      label: primaryButtonText,
      onClick: primaryButtonAction,
      loading: isLoading,
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
          <DialogTitle>{t("environments.surveys.edit.caution_edit_published_survey")}</DialogTitle>
          <DialogDescription>{t("environments.surveys.edit.caution_recommendation")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p>{t("environments.surveys.edit.caution_explanation_intro")}</p>
          <ul className="mt-3 list-disc space-y-0.5 pl-5">
            <li>{t("environments.surveys.edit.caution_explanation_responses_are_safe")}</li>
            <li>{t("environments.surveys.edit.caution_explanation_new_responses_separated")}</li>
            <li>{t("environments.surveys.edit.caution_explanation_only_new_responses_in_summary")}</li>
          </ul>
        </DialogBody>

        <DialogFooter>
          {actions.map(({ label, onClick, loading, variant, disabled }) => (
            <Button key={label} variant={variant} onClick={onClick} loading={loading} disabled={disabled}>
              {label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
