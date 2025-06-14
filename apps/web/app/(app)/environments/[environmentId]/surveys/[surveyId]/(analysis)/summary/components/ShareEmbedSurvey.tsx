"use client";

import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { Badge } from "@/modules/ui/components/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import {
  BellRing,
  BlocksIcon,
  Code2Icon,
  LinkIcon,
  MailIcon,
  SmartphoneIcon,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { EmbedView } from "./shareEmbedModal/EmbedView";
import { PanelInfoView } from "./shareEmbedModal/PanelInfoView";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  publicDomain: string;
  open: boolean;
  modalView: "start" | "embed" | "panel";
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  user: TUser;
}

export const ShareEmbedSurvey = ({
  survey,
  publicDomain,
  open,
  modalView,
  setOpen,
  user,
}: ShareEmbedSurveyProps) => {
  const router = useRouter();
  const environmentId = survey.environmentId;
  const isSingleUseLinkSurvey = survey.singleUse?.enabled ?? false;
  const { email } = user;
  const { t } = useTranslate();
  const tabs = useMemo(
    () =>
      [
        { id: "email", label: t("environments.surveys.summary.embed_in_an_email"), icon: MailIcon },
        { id: "webpage", label: t("environments.surveys.summary.embed_on_website"), icon: Code2Icon },
        {
          id: "link",
          label: `${isSingleUseLinkSurvey ? t("environments.surveys.summary.single_use_links") : t("environments.surveys.summary.share_the_link")}`,
          icon: LinkIcon,
        },
        { id: "app", label: t("environments.surveys.summary.embed_in_app"), icon: SmartphoneIcon },
      ].filter((tab) => !(survey.type === "link" && tab.id === "app")),
    [t, isSingleUseLinkSurvey, survey.type]
  );

  const [activeId, setActiveId] = useState(survey.type === "link" ? tabs[0].id : tabs[3].id);
  const [showView, setShowView] = useState<"start" | "embed" | "panel">("start");
  const [surveyUrl, setSurveyUrl] = useState("");

  useEffect(() => {
    const fetchSurveyUrl = async () => {
      try {
        const url = await getSurveyUrl(survey, publicDomain, "default");
        setSurveyUrl(url);
      } catch (error) {
        console.error("Failed to fetch survey URL:", error);
        // Fallback to a default URL if fetching fails
        setSurveyUrl(`${publicDomain}/s/${survey.id}`);
      }
    };
    fetchSurveyUrl();
  }, [survey, publicDomain]);

  useEffect(() => {
    if (survey.type !== "link") {
      setActiveId(tabs[3].id);
    }
  }, [survey.type, tabs]);

  useEffect(() => {
    if (open) {
      setShowView(modalView);
    } else {
      setShowView("start");
    }
  }, [open, modalView]);

  const handleOpenChange = (open: boolean) => {
    setActiveId(survey.type === "link" ? tabs[0].id : tabs[3].id);
    setOpen(open);
    if (!open) {
      setShowView("start");
    }
    router.refresh();
  };

  const handleInitialPageButton = () => {
    setShowView("start");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTitle className="sr-only" />
      <DialogContent className="w-full max-w-xl bg-white p-0 md:max-w-3xl lg:h-[700px] lg:max-w-5xl">
        {showView === "start" ? (
          <div className="h-full max-w-full overflow-hidden">
            <div className="flex h-[200px] w-full flex-col items-center justify-center space-y-6 p-8 text-center lg:h-2/5">
              <DialogTitle>
                <p className="pt-2 text-xl font-semibold text-slate-800">
                  {t("environments.surveys.summary.your_survey_is_public")} 🎉
                </p>
              </DialogTitle>
              <DialogDescription className="hidden" />
              <ShareSurveyLink
                survey={survey}
                surveyUrl={surveyUrl}
                publicDomain={publicDomain}
                setSurveyUrl={setSurveyUrl}
                locale={user.locale}
              />
            </div>
            <div className="flex h-[300px] flex-col items-center justify-center gap-8 rounded-b-lg bg-slate-50 px-8 lg:h-3/5">
              <p className="-mt-8 text-sm text-slate-500">{t("environments.surveys.summary.whats_next")}</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setShowView("embed")}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <Code2Icon className="h-6 w-6 text-slate-700" />
                  {t("environments.surveys.summary.embed_survey")}
                </button>
                <Link
                  href={`/environments/${environmentId}/settings/notifications`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BellRing className="h-6 w-6 text-slate-700" />
                  {t("environments.surveys.summary.configure_alerts")}
                </Link>
                <Link
                  href={`/environments/${environmentId}/integrations`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BlocksIcon className="h-6 w-6 text-slate-700" />
                  {t("environments.surveys.summary.setup_integrations")}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowView("panel")}
                  className="relative flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <UsersRound className="h-6 w-6 text-slate-700" />
                  {t("environments.surveys.summary.send_to_panel")}
                  <Badge
                    size="tiny"
                    type="success"
                    className="absolute right-3 top-3"
                    text={t("common.new")}
                  />
                </button>
              </div>
            </div>
          </div>
        ) : showView === "embed" ? (
          <EmbedView
            handleInitialPageButton={handleInitialPageButton}
            tabs={survey.type === "link" ? tabs : [tabs[3]]}
            disableBack={false}
            activeId={activeId}
            environmentId={environmentId}
            setActiveId={setActiveId}
            survey={survey}
            email={email}
            surveyUrl={surveyUrl}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            locale={user.locale}
          />
        ) : showView === "panel" ? (
          <PanelInfoView handleInitialPageButton={handleInitialPageButton} disableBack={false} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
