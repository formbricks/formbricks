"use client";

import { getSurveyUrl } from "@/modules/analysis/utils";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { Code2Icon, LinkIcon, MailIcon, SmartphoneIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { ShareView } from "./shareEmbedModal/share-view";
import { SuccessView } from "./shareEmbedModal/success-view";

type ModalView = "start" | "share";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  publicDomain: string;
  open: boolean;
  modalView: ModalView;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  user: TUser;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
}

export const ShareSurveyModal = ({
  survey,
  publicDomain,
  open,
  modalView,
  setOpen,
  user,
  segments,
  isContactsEnabled,
  isFormbricksCloud,
}: ShareEmbedSurveyProps) => {
  const environmentId = survey.environmentId;
  const isSingleUseLinkSurvey = survey.singleUse?.enabled ?? false;
  const { email } = user;
  const { t } = useTranslate();
  const tabs = useMemo(
    () =>
      [
        {
          id: "link",
          label: `${isSingleUseLinkSurvey ? t("environments.surveys.summary.single_use_links") : t("environments.surveys.summary.share_the_link")}`,
          icon: LinkIcon,
        },
        { id: "personal-links", label: t("environments.surveys.summary.personal_links"), icon: UserIcon },
        { id: "email", label: t("environments.surveys.summary.embed_in_an_email"), icon: MailIcon },
        { id: "webpage", label: t("environments.surveys.summary.embed_on_website"), icon: Code2Icon },

        { id: "app", label: t("environments.surveys.summary.embed_in_app"), icon: SmartphoneIcon },
      ].filter((tab) => !(survey.type === "link" && tab.id === "app")),
    [t, isSingleUseLinkSurvey, survey.type]
  );

  const [activeId, setActiveId] = useState(survey.type === "link" ? tabs[0].id : tabs[4].id);
  const [showView, setShowView] = useState<ModalView>(modalView);
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
    if (open) {
      setShowView(modalView);
    }
  }, [open, modalView]);

  const handleOpenChange = (open: boolean) => {
    setActiveId(survey.type === "link" ? tabs[0].id : tabs[4].id);
    setOpen(open);
    if (!open) {
      setShowView("start");
    }
  };

  const handleViewChange = (view: ModalView) => {
    setShowView(view);
  };

  const handleEmbedViewWithTab = (tabId: string) => {
    setShowView("share");
    setActiveId(tabId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full bg-white p-0 lg:h-[700px]" width="wide">
        {showView === "start" ? (
          <SuccessView
            survey={survey}
            surveyUrl={surveyUrl}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            user={user}
            tabs={tabs}
            handleViewChange={handleViewChange}
            handleEmbedViewWithTab={handleEmbedViewWithTab}
          />
        ) : (
          <ShareView
            tabs={survey.type === "link" ? tabs : [tabs[4]]}
            activeId={activeId}
            environmentId={environmentId}
            setActiveId={setActiveId}
            survey={survey}
            email={email}
            surveyUrl={surveyUrl}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            locale={user.locale}
            segments={segments}
            isContactsEnabled={isContactsEnabled}
            isFormbricksCloud={isFormbricksCloud}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
