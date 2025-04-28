import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
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
    loading?: boolean;
    variant: React.ComponentProps<typeof Button>["variant"];
  }>;
  if (secondaryButtonAction) {
    actions.push({
      label: secondaryButtonText,
      onClick: secondaryButtonAction,
      variant: "outline",
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
    <Modal open={open} setOpen={setOpen} title={t("environments.surveys.edit.caution_edit_published_survey")}>
      <p>{t("environments.surveys.edit.caution_recommendation")}</p>
      <p className="mt-3">{t("environments.surveys.edit.caution_explanation_intro")}</p>
      <ul className="mt-3 list-disc space-y-0.5 pl-5">
        <li>{t("environments.surveys.edit.caution_explanation_responses_are_safe")}</li>
        <li>{t("environments.surveys.edit.caution_explanation_new_responses_separated")}</li>
        <li>{t("environments.surveys.edit.caution_explanation_only_new_responses_in_summary")}</li>
        <li>{t("environments.surveys.edit.caution_explanation_all_data_as_download")}</li>
      </ul>
      <div className="my-4 space-x-2 text-right">
        {actions.map(({ label, onClick, loading, variant }) => (
          <Button key={label} variant={variant} onClick={onClick} loading={loading}>
            {label}
          </Button>
        ))}
      </div>
    </Modal>
  );
};
