"use client";

import { BellRing, Eye, ListRestart, RefreshCcwIcon, SquarePenIcon, Wand2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSegment } from "@formbricks/types/segment";
import { TUser } from "@formbricks/types/user";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { useResponseFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { SuccessMessage } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { ShareSurveyModal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/share-survey-modal";
import { SurveyStatusDropdown } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { useSurvey } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/context/survey-context";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { copySurveyToOtherWorkspaceAction } from "@/modules/survey/list/actions";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { IconBar } from "@/modules/ui/components/iconbar";
import { generateExampleResponsesAction, resetSurveyAction } from "../actions";

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
  aiUnavailableReason: TAIUnavailableReason | null;
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
  aiUnavailableReason,
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
  const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);

  const { workspace } = useWorkspaceContext();
  const { survey } = useSurvey();
  const { refreshSingleUseId } = useSingleUseId(survey, isReadOnly);
  const { refreshAnalysisData } = useResponseFilter();

  const appSetupCompleted = survey.type === "app" && workspace.appSetupCompleted;

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
    const duplicatedSurveyResponse = await copySurveyToOtherWorkspaceAction({
      surveyId: surveyId,
      targetWorkspaceId: workspace.id,
    });
    if (duplicatedSurveyResponse?.data) {
      toast.success(t("workspace.surveys.survey_duplicated_successfully"));
      router.push(`/workspaces/${workspace?.id}/surveys/${duplicatedSurveyResponse.data.id}/edit`);
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
      workspaceId: workspace.id,
    });
    if (result?.data) {
      toast.success(
        t("workspace.surveys.summary.survey_reset_successfully", {
          responseCount: result.data.deletedResponsesCount,
          displayCount: result.data.deletedDisplaysCount,
        })
      );
      router.refresh();
      await refreshAnalysisData();
    } else {
      const errorMessage = getFormattedErrorMessage(result);
      toast.error(errorMessage);
    }
    setIsResetting(false);
    setIsResetModalOpen(false);
  };

  const handleGenerateExampleResponses = async () => {
    if (isGeneratingExamples) return;
    setIsGeneratingExamples(true);
    const loadingToastId = toast.loading(t("workspace.surveys.summary.generating_example_responses"));
    try {
      const result = await generateExampleResponsesAction({ surveyId: survey.id });
      if (result?.data) {
        toast.success(
          t("workspace.surveys.summary.example_responses_generated_successfully", {
            count: result.data.createdCount,
          }),
          { id: loadingToastId }
        );
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage || t("workspace.surveys.summary.example_responses_generation_failed"), {
          id: loadingToastId,
        });
      }
    } finally {
      setIsGeneratingExamples(false);
    }
  };

  const exampleResponsesTooltip = (() => {
    if (isGeneratingExamples) {
      return t("workspace.surveys.summary.generating_example_responses");
    }
    if (aiUnavailableReason === "not_in_plan") {
      return t("workspace.surveys.summary.generate_example_responses_locked_plan");
    }
    if (aiUnavailableReason === "not_enabled") {
      return t("workspace.surveys.summary.generate_example_responses_locked_disabled");
    }
    if (aiUnavailableReason === "instance_not_configured") {
      return t("workspace.surveys.summary.generate_example_responses_locked_instance");
    }
    if (responseCount > 0) {
      return t("workspace.surveys.summary.generate_example_responses_disabled_has_responses");
    }
    return t("workspace.surveys.summary.generate_example_responses");
  })();

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
      tooltip: t("workspace.surveys.summary.configure_alerts"),
      onClick: () => router.push(`/account/settings/notifications`),
      isVisible: !isReadOnly && !survey.archivedAt,
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
      icon: Wand2,
      tooltip: exampleResponsesTooltip,
      onClick: handleGenerateExampleResponses,
      disabled: isGeneratingExamples || aiUnavailableReason !== null || responseCount > 0,
      isVisible: !isReadOnly && !survey.archivedAt,
    },
    {
      icon: ListRestart,
      tooltip: t("workspace.surveys.summary.reset_survey"),
      onClick: () => setIsResetModalOpen(true),
      isVisible: !isReadOnly && !survey.archivedAt,
    },
    {
      icon: SquarePenIcon,
      tooltip: t("common.edit"),
      onClick: () => {
        responseCount > 0
          ? setIsCautionDialogOpen(true)
          : router.push(`/workspaces/${workspace?.id}/surveys/${survey.id}/edit`);
      },
      // Archived surveys are read-only; editing is blocked server-side, so hide the entry point too.
      isVisible: !isReadOnly && !survey.archivedAt,
    },
  ];

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {!isReadOnly && (appSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown />
      )}

      <IconBar actions={iconActions} />
      {!survey.archivedAt && (
        <Button
          onClick={() => {
            setModalState((prev) => ({ ...prev, share: true }));
          }}>
          {t("workspace.surveys.summary.share_survey")}
        </Button>
      )}

      {user && !survey.archivedAt && (
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
          workspaceCustomScripts={workspace.customHeadScripts}
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
          primaryButtonText={t("workspace.surveys.edit.caution_edit_duplicate")}
          secondaryButtonAction={() => router.push(`/workspaces/${workspace?.id}/surveys/${survey.id}/edit`)}
          secondaryButtonText={t("common.edit")}
        />
      )}

      <ConfirmationModal
        open={isResetModalOpen}
        setOpen={setIsResetModalOpen}
        title={t("workspace.surveys.summary.delete_all_existing_responses_and_displays")}
        body={t("workspace.surveys.summary.reset_survey_warning")}
        buttonText={t("workspace.surveys.summary.reset_survey")}
        onConfirm={handleResetSurvey}
        buttonVariant="destructive"
        buttonLoading={isResetting}
      />
    </div>
  );
};
