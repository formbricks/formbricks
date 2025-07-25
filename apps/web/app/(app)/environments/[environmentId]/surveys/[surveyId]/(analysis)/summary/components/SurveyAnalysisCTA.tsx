"use client";

import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { ShareSurveyModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/share-survey-modal";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { IconBar } from "@/modules/ui/components/iconbar";
import { useTranslate } from "@tolgee/react";
import { BellRing, Eye, ListRestart, SquarePenIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { resetSurveyAction } from "../actions";

interface SurveyAnalysisCTAProps {
  survey: TSurvey;
  environment: TEnvironment;
  isReadOnly: boolean;
  user: TUser;
  publicDomain: string;
  responseCount: number;
  displayCount: number;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
}

interface ModalState {
  start: boolean;
  share: boolean;
}

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isReadOnly,
  user,
  publicDomain,
  responseCount,
  displayCount,
  segments,
  isContactsEnabled,
  isFormbricksCloud,
}: SurveyAnalysisCTAProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({
    start: searchParams.get("share") === "true",
    share: false,
  });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { organizationId, project } = useEnvironment();
  const { refreshSingleUseId } = useSingleUseId(survey, isReadOnly);

  const widgetSetupCompleted = survey.type === "app" && environment.appSetupCompleted;

  useEffect(() => {
    setModalState((prev) => ({
      ...prev,
      start: searchParams.get("share") === "true",
    }));
  }, [searchParams]);

  const handleShareModalToggle = (open: boolean) => {
    const params = new URLSearchParams(window.location.search);
    const currentShareParam = params.get("share") === "true";

    if (open && !currentShareParam) {
      params.set("share", "true");
      router.push(`${pathname}?${params.toString()}`);
    } else if (!open && currentShareParam) {
      params.delete("share");
      router.push(`${pathname}?${params.toString()}`);
    }

    setModalState((prev) => ({ ...prev, start: open }));
  };

  const duplicateSurveyAndRoute = async (surveyId: string) => {
    setLoading(true);
    const duplicatedSurveyResponse = await copySurveyToOtherEnvironmentAction({
      environmentId: environment.id,
      surveyId: surveyId,
      targetEnvironmentId: environment.id,
    });
    if (duplicatedSurveyResponse?.data) {
      toast.success(t("environments.surveys.survey_duplicated_successfully"));
      router.push(`/environments/${environment.id}/surveys/${duplicatedSurveyResponse.data.id}/edit`);
    } else {
      const errorMessage = getFormattedErrorMessage(duplicatedSurveyResponse);
      toast.error(errorMessage);
    }
    setIsCautionDialogOpen(false);
    setLoading(false);
  };

  const getPreviewUrl = async () => {
    const surveyUrl = new URL(`${publicDomain}/s/${survey.id}`);

    if (survey.singleUse?.enabled) {
      const newId = await refreshSingleUseId();
      if (newId) {
        surveyUrl.searchParams.set("suId", newId);
      }
    }

    surveyUrl.searchParams.set("preview", "true");
    return surveyUrl.toString();
  };

  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

  const handleResetSurvey = async () => {
    setIsResetting(true);
    const result = await resetSurveyAction({
      surveyId: survey.id,
      organizationId: organizationId,
      projectId: project.id,
    });
    if (result?.data) {
      toast.success(
        t("environments.surveys.summary.survey_reset_successfully", {
          responseCount: result.data.deletedResponsesCount,
          displayCount: result.data.deletedDisplaysCount,
        })
      );
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(result);
      toast.error(errorMessage);
    }
    setIsResetting(false);
    setIsResetModalOpen(false);
  };

  const iconActions = [
    {
      icon: BellRing,
      tooltip: t("environments.surveys.summary.configure_alerts"),
      onClick: () => router.push(`/environments/${survey.environmentId}/settings/notifications`),
      isVisible: !isReadOnly,
    },
    {
      icon: Eye,
      tooltip: t("common.preview"),
      onClick: async () => {
        const previewUrl = await getPreviewUrl();
        window.open(previewUrl, "_blank");
      },
      isVisible: survey.type === "link",
    },
    {
      icon: ListRestart,
      tooltip: t("environments.surveys.summary.reset_survey"),
      onClick: () => setIsResetModalOpen(true),
      isVisible: !isReadOnly && (responseCount > 0 || displayCount > 0),
    },
    {
      icon: SquarePenIcon,
      tooltip: t("common.edit"),
      onClick: () => {
        responseCount > 0
          ? setIsCautionDialogOpen(true)
          : router.push(`/environments/${environment.id}/surveys/${survey.id}/edit`);
      },
      isVisible: !isReadOnly,
    },
  ];

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {!isReadOnly && (widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      )}

      <IconBar actions={iconActions} />
      <Button
        onClick={() => {
          setModalState((prev) => ({ ...prev, share: true }));
        }}>
        {t("environments.surveys.summary.share_survey")}
      </Button>

      {user && (
        <ShareSurveyModal
          survey={survey}
          publicDomain={publicDomain}
          open={modalState.start || modalState.share}
          setOpen={(open) => {
            if (!open) {
              handleShareModalToggle(false);
              setModalState((prev) => ({ ...prev, share: false }));
            }
          }}
          user={user}
          modalView={modalState.start ? "start" : "share"}
          segments={segments}
          isContactsEnabled={isContactsEnabled}
          isFormbricksCloud={isFormbricksCloud}
          isReadOnly={isReadOnly}
        />
      )}
      <SuccessMessage environment={environment} survey={survey} />

      {responseCount > 0 && (
        <EditPublicSurveyAlertDialog
          open={isCautionDialogOpen}
          setOpen={setIsCautionDialogOpen}
          isLoading={loading}
          primaryButtonAction={() => duplicateSurveyAndRoute(survey.id)}
          primaryButtonText={t("environments.surveys.edit.caution_edit_duplicate")}
          secondaryButtonAction={() =>
            router.push(`/environments/${environment.id}/surveys/${survey.id}/edit`)
          }
          secondaryButtonText={t("common.edit")}
        />
      )}

      <ConfirmationModal
        open={isResetModalOpen}
        setOpen={setIsResetModalOpen}
        title={t("environments.surveys.summary.delete_all_existing_responses_and_displays")}
        text={t("environments.surveys.summary.reset_survey_warning")}
        buttonText={t("environments.surveys.summary.reset_survey")}
        onConfirm={handleResetSurvey}
        buttonVariant="destructive"
        buttonLoading={isResetting}
      />
    </div>
  );
};
