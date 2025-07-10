"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { IconBar } from "@/modules/ui/components/iconbar";
import { useTranslate } from "@tolgee/react";
import { BellRing, Eye, SquarePenIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";

interface SurveyAnalysisCTAProps {
  survey: TSurvey;
  environment: TEnvironment;
  isReadOnly: boolean;
  user: TUser;
  publicDomain: string;
  responseCount: number;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
}

interface ModalState {
  share: boolean;
  embed: boolean;
  panel: boolean;
  dropdown: boolean;
}

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isReadOnly,
  user,
  publicDomain,
  responseCount,
  segments,
  isContactsEnabled,
  isFormbricksCloud,
}: SurveyAnalysisCTAProps) => {
  const { t } = useTranslate();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [modalState, setModalState] = useState<ModalState>({
    share: searchParams.get("share") === "true",
    embed: false,
    panel: false,
    dropdown: false,
  });

  const surveyUrl = useMemo(() => `${publicDomain}/s/${survey.id}`, [survey.id, publicDomain]);

  const widgetSetupCompleted = survey.type === "app" && environment.appSetupCompleted;

  useEffect(() => {
    setModalState((prev) => ({
      ...prev,
      share: searchParams.get("share") === "true",
    }));
  }, [searchParams]);

  const handleShareModalToggle = (open: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set("share", "true");
    } else {
      params.delete("share");
    }
    router.push(`${pathname}?${params.toString()}`);
    setModalState((prev) => ({ ...prev, share: open }));
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

  const getPreviewUrl = () => {
    const separator = surveyUrl.includes("?") ? "&" : "?";
    return `${surveyUrl}${separator}preview=true`;
  };

  const handleModalState = (modalView: keyof Omit<ModalState, "dropdown">) => {
    return (open: boolean | ((prevState: boolean) => boolean)) => {
      const newValue = typeof open === "function" ? open(modalState[modalView]) : open;
      setModalState((prev) => ({ ...prev, [modalView]: newValue }));
    };
  };

  const shareEmbedViews = [
    { key: "share", modalView: "start" as const, setOpen: handleShareModalToggle },
    { key: "embed", modalView: "embed" as const, setOpen: handleModalState("embed") },
    { key: "panel", modalView: "panel" as const, setOpen: handleModalState("panel") },
  ];

  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

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
      onClick: () => window.open(getPreviewUrl(), "_blank"),
      isVisible: survey.type === "link",
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
      {survey.resultShareKey && (
        <Badge
          type="warning"
          size="normal"
          className="rounded-lg"
          text={t("environments.surveys.summary.results_are_public")}
        />
      )}

      {!isReadOnly && (widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      )}

      <IconBar actions={iconActions} />
      <Button
        className="h-10"
        onClick={() => {
          setModalState((prev) => ({ ...prev, embed: true }));
        }}>
        {t("environments.surveys.summary.share_survey")}
      </Button>

      {user && (
        <>
          {shareEmbedViews.map(({ key, modalView, setOpen }) => (
            <ShareEmbedSurvey
              key={key}
              survey={survey}
              publicDomain={publicDomain}
              open={modalState[key as keyof ModalState]}
              setOpen={setOpen}
              user={user}
              modalView={modalView}
              segments={segments}
              isContactsEnabled={isContactsEnabled}
              isFormbricksCloud={isFormbricksCloud}
            />
          ))}
          <SuccessMessage environment={environment} survey={survey} />
        </>
      )}

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
    </div>
  );
};
