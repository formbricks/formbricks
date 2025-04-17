"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { copySurveyLink } from "@/modules/survey/lib/client-utils";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { Badge } from "@/modules/ui/components/badge";
import { CustomDialog } from "@/modules/ui/components/custom-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";
import { useTranslate } from "@tolgee/react";
import { BellRing, Code2Icon, Eye, LinkIcon, SquarePenIcon, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";

interface SurveyAnalysisCTAProps {
  survey: TSurvey;
  environment: TEnvironment;
  isReadOnly: boolean;
  user: TUser;
  surveyDomain: string;
  responseCount: number;
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
  surveyDomain,
  responseCount,
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

  const surveyUrl = useMemo(() => `${surveyDomain}/s/${survey.id}`, [survey.id, surveyDomain]);
  const { refreshSingleUseId } = useSingleUseId(survey);

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

  const handleCopyLink = () => {
    refreshSingleUseId()
      .then((newId) => {
        const linkToCopy = copySurveyLink(surveyUrl, newId);
        return navigator.clipboard.writeText(linkToCopy);
      })
      .then(() => {
        toast.success(t("common.copied_to_clipboard"));
      })
      .catch((err) => {
        toast.error(t("environments.surveys.summary.failed_to_copy_link"));
        console.error(err);
      });
    setModalState((prev) => ({ ...prev, dropdown: false }));
  };

  const duplicateSurveyAndRoute = async (surveyId: string) => {
    setLoading(true);
    try {
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
    } catch (error) {
      toast.error(t("environments.surveys.survey_duplication_error"));
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
      icon: Eye,
      tooltip: t("common.preview"),
      onClick: () => window.open(getPreviewUrl(), "_blank"),
      isVisible: survey.type === "link",
    },
    {
      icon: LinkIcon,
      tooltip: t("common.copy_link"),
      onClick: handleCopyLink,
      isVisible: survey.type === "link",
    },
    {
      icon: Code2Icon,
      tooltip: t("common.embed"),
      onClick: () => handleModalState("embed")(true),
      isVisible: !isReadOnly,
    },
    {
      icon: BellRing,
      tooltip: t("environments.surveys.summary.configure_alerts"),
      onClick: () => router.push(`/environments/${survey.environmentId}/settings/notifications`),
      isVisible: !isReadOnly,
    },
    {
      icon: UsersRound,
      tooltip: t("environments.surveys.summary.send_to_panel"),
      onClick: () => {
        handleModalState("panel")(true);
        setModalState((prev) => ({ ...prev, dropdown: false }));
      },
      isVisible: !isReadOnly,
    },
    {
      icon: SquarePenIcon,
      tooltip: t("common.edit"),
      onClick: () => {
        responseCount && responseCount > 0
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

      {user && (
        <>
          {shareEmbedViews.map(({ key, modalView, setOpen }) => (
            <ShareEmbedSurvey
              key={key}
              survey={survey}
              surveyDomain={surveyDomain}
              open={modalState[key as keyof ModalState]}
              setOpen={setOpen}
              user={user}
              modalView={modalView}
            />
          ))}
          <SuccessMessage environment={environment} survey={survey} />
        </>
      )}

      {responseCount > 0 && (
        <CustomDialog
          open={isCautionDialogOpen}
          setOpen={setIsCautionDialogOpen}
          title={t("environments.surveys.edit.caution_edit_published_survey")}
          isLoading={loading}
          okBtnText={t("environments.surveys.edit.caution_edit_duplicate")}
          okBtnVariant="default"
          onOk={async () => await duplicateSurveyAndRoute(survey.id)}
          cancelBtnText={t("common.edit")}
          cancelBtnVariant="outline"
          onCancel={() => router.push(`/environments/${environment.id}/surveys/${survey.id}/edit`)}>
          <p>{t("environments.surveys.edit.caution_recommendation")}</p>
          <p className="mt-3">{t("environments.surveys.edit.caution_explanation_intro")}</p>
          <ul className="mt-3 list-disc space-y-0.5 pl-5">
            <li>{t("environments.surveys.edit.caution_explanation_responses_are_safe")}</li>
            <li>{t("environments.surveys.edit.caution_explanation_new_responses_separated")}</li>
            <li>{t("environments.surveys.edit.caution_explanation_only_new_responses_in_summary")}</li>
            <li>{t("environments.surveys.edit.caution_explanation_all_data_as_download")}</li>
          </ul>
        </CustomDialog>
      )}
    </div>
  );
};
