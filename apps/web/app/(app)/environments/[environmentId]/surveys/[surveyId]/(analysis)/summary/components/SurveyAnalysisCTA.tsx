"use client";

import { BellRing, Eye, ListRestart, RefreshCcwIcon, SquarePenIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSegment } from "@formbricks/types/segment";
import { TUser } from "@formbricks/types/user";
import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { ShareSurveyModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/share-survey-modal";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { IconBar } from "@/modules/ui/components/iconbar";
import { resetSurveyAction } from "../actions";

interface SurveyAnalysisCTAProps {
  isReadOnly: boolean;
  user: TUser;
  publicDomain: string;
  responseCount: number;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
  isStorageConfigured: boolean;
  enterpriseLicenseRequestFormUrl: string;
}

interface ModalState {
  start: boolean;
  share: boolean;
}

export const SurveyAnalysisCTA = ({
  isReadOnly,
  user,
  publicDomain,
  responseCount,
  segments,
  isContactsEnabled,
  isFormbricksCloud,
  isStorageConfigured,
  enterpriseLicenseRequestFormUrl,
}: SurveyAnalysisCTAProps) => {
  const { t } = useTranslation();
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { environment, project } = useEnvironment();
  const { survey } = useSurvey();
  const { refreshSingleUseId } = useSingleUseId(survey, isReadOnly);
  const { refreshAnalysisData } = useResponseFilter();

  const appSetupCompleted = survey.type === "app" && environment.appSetupCompleted;

  useEffect(() => {
    setModalState((prev) => ({
      ...prev,
      start: searchParams.get("share") === "true",
    }));
  }, [searchParams]);

  const handleShareModalToggle = (open: boolean) => {
    const params = new URLSearchParams(globalThis.location.search);
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
      const singleUseLinkParams = await refreshSingleUseId();
      if (singleUseLinkParams) {
        surveyUrl.searchParams.set("suId", singleUseLinkParams.suId);
        if (singleUseLinkParams.suToken) {
          surveyUrl.searchParams.set("suToken", singleUseLinkParams.suToken);
        }
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
      icon: RefreshCcwIcon,
      tooltip: t("common.refresh"),
      onClick: async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
          await refreshAnalysisData();
          toast.success(t("common.data_refreshed_successfully"));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : t("common.something_went_wrong");
          toast.error(errorMessage);
        } finally {
          setIsRefreshing(false);
        }
      },
      disabled: isRefreshing,
      isVisible: true,
    },
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
      isVisible: !isReadOnly,
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
      {!isReadOnly && (appSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown />
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
          isStorageConfigured={isStorageConfigured}
          projectCustomScripts={project.customHeadScripts}
          enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
        />
      )}
      <SuccessMessage />

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
        body={t("environments.surveys.summary.reset_survey_warning")}
        buttonText={t("environments.surveys.summary.reset_survey")}
        onConfirm={handleResetSurvey}
        buttonVariant="destructive"
        buttonLoading={isResetting}
      />
    </div>
  );
};
