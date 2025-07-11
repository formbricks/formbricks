"use client";

import { AppTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/AppTab";
import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/TabContainer";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslate } from "@tolgee/react";
import { Code2Icon, LinkIcon, MailIcon, SquareStack, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logger } from "@formbricks/logger";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { ShareView } from "./shareEmbedModal/share-view";
import { SuccessView } from "./shareEmbedModal/success-view";

type ModalView = "start" | "share";

enum ShareViewType {
  LINK = "link",
  PERSONAL_LINKS = "personal-links",
  EMAIL = "email",
  WEBSITE_EMBED = "website-embed",
  DYNAMIC_POPUP = "dynamic-popup",
  APP = "app",
}

interface ShareSurveyModalProps {
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
}: ShareSurveyModalProps) => {
  const environmentId = survey.environmentId;
  const isSingleUseLinkSurvey = survey.singleUse?.enabled ?? false;
  const { email } = user;
  const { t } = useTranslate();
  const linkTabs: { id: ShareViewType; label: string; icon: React.ElementType }[] = useMemo(
    () => [
      {
        id: ShareViewType.LINK,
        label: `${isSingleUseLinkSurvey ? t("environments.surveys.summary.single_use_links") : t("environments.surveys.summary.share_the_link")}`,
        icon: LinkIcon,
      },
      {
        id: ShareViewType.PERSONAL_LINKS,
        label: t("environments.surveys.summary.personal_links"),
        icon: UserIcon,
      },
      {
        id: ShareViewType.EMAIL,
        label: t("environments.surveys.summary.embed_in_an_email"),
        icon: MailIcon,
      },
      {
        id: ShareViewType.WEBSITE_EMBED,
        label: t("environments.surveys.summary.embed_on_website"),
        icon: Code2Icon,
      },
      {
        id: ShareViewType.DYNAMIC_POPUP,
        label: t("environments.surveys.summary.dynamic_popup"),
        icon: SquareStack,
      },
    ],
    [t, isSingleUseLinkSurvey]
  );

  const [activeId, setActiveId] = useState(survey.type === "link" ? ShareViewType.LINK : ShareViewType.APP);
  const [showView, setShowView] = useState<ModalView>(modalView);
  const [surveyUrl, setSurveyUrl] = useState("");

  useEffect(() => {
    const fetchSurveyUrl = async () => {
      try {
        const url = await getSurveyUrl(survey, publicDomain, "default");
        setSurveyUrl(url);
      } catch (error) {
        logger.error("Failed to fetch survey URL:", error);
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
    setActiveId(survey.type === "link" ? ShareViewType.LINK : ShareViewType.APP);
    setOpen(open);
    if (!open) {
      setShowView("start");
    }
  };

  const handleViewChange = (view: ModalView) => {
    setShowView(view);
  };

  const handleEmbedViewWithTab = (tabId: ShareViewType) => {
    setShowView("share");
    setActiveId(tabId);
  };

  const renderContent = () => {
    if (showView === "start") {
      return (
        <SuccessView
          survey={survey}
          surveyUrl={surveyUrl}
          publicDomain={publicDomain}
          setSurveyUrl={setSurveyUrl}
          user={user}
          tabs={linkTabs}
          handleViewChange={handleViewChange}
          handleEmbedViewWithTab={handleEmbedViewWithTab}
        />
      );
    }

    if (survey.type === "link") {
      return (
        <ShareView
          tabs={linkTabs}
          activeId={activeId}
          setActiveId={setActiveId}
          environmentId={environmentId}
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
      );
    }

    return (
      <div className={`h-full w-full bg-slate-50 p-6`}>
        <TabContainer
          title={t("environments.surveys.summary.in_app.title")}
          description={t("environments.surveys.summary.in_app.description")}>
          <AppTab />
        </TabContainer>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <VisuallyHidden asChild>
        <DialogTitle />
      </VisuallyHidden>
      <DialogContent className="w-full bg-white p-0 lg:h-[700px]" width="wide" aria-describedby={undefined}>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
