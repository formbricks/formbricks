"use client";

import { AnonymousLinksTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/anonymous-links-tab";
import { AppTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/app-tab";
import { DynamicPopupTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/dynamic-popup-tab";
import { EmailTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/email-tab";
import { PersonalLinksTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/personal-links-tab";
import { QRCodeTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/qr-code-tab";
import { SocialMediaTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/social-media-tab";
import { WebsiteEmbedTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/website-embed-tab";
import { ShareViewType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/types/share";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslate } from "@tolgee/react";
import {
  Code2Icon,
  LinkIcon,
  MailIcon,
  QrCodeIcon,
  Share2Icon,
  SmartphoneIcon,
  SquareStack,
  UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { ShareView } from "./shareEmbedModal/share-view";
import { SuccessView } from "./shareEmbedModal/success-view";

type ModalView = "start" | "share";

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
  const [surveyUrl, setSurveyUrl] = useState<string>(getSurveyUrl(survey, publicDomain, "default"));
  const [showView, setShowView] = useState<ModalView>(modalView);
  const { email } = user;
  const { t } = useTranslate();
  const linkTabs: {
    id: ShareViewType;
    label: string;
    icon: React.ElementType;
    title: string;
    description: string;
    componentType: React.ComponentType<any>;
    componentProps: any;
  }[] = useMemo(
    () => [
      {
        id: ShareViewType.ANON_LINKS,
        label: t("environments.surveys.share.anonymous_links.nav_title"),
        icon: LinkIcon,
        title: t("environments.surveys.share.anonymous_links.nav_title"),
        description: t("environments.surveys.share.anonymous_links.description"),
        componentType: AnonymousLinksTab,
        componentProps: {
          survey,
          publicDomain,
          setSurveyUrl,
          locale: user.locale,
          surveyUrl,
        },
      },
      {
        id: ShareViewType.PERSONAL_LINKS,
        label: t("environments.surveys.share.personal_links.nav_title"),
        icon: UserIcon,
        title: t("environments.surveys.share.personal_links.nav_title"),
        description: t("environments.surveys.share.personal_links.description"),
        componentType: PersonalLinksTab,
        componentProps: {
          environmentId,
          surveyId: survey.id,
          segments,
          isContactsEnabled,
          isFormbricksCloud,
        },
      },
      {
        id: ShareViewType.WEBSITE_EMBED,
        label: t("environments.surveys.share.embed_on_website.nav_title"),
        icon: Code2Icon,
        title: t("environments.surveys.share.embed_on_website.nav_title"),
        description: t("environments.surveys.share.embed_on_website.description"),
        componentType: WebsiteEmbedTab,
        componentProps: { surveyUrl },
      },
      {
        id: ShareViewType.EMAIL,
        label: t("environments.surveys.share.send_email.nav_title"),
        icon: MailIcon,
        title: t("environments.surveys.share.send_email.nav_title"),
        description: t("environments.surveys.share.send_email.description"),
        componentType: EmailTab,
        componentProps: { surveyId: survey.id, email },
      },
      {
        id: ShareViewType.SOCIAL_MEDIA,
        label: t("environments.surveys.share.social_media.title"),
        icon: Share2Icon,
        title: t("environments.surveys.share.social_media.title"),
        description: t("environments.surveys.share.social_media.description"),
        componentType: SocialMediaTab,
        componentProps: { surveyUrl, surveyTitle: survey.name },
      },
      {
        id: ShareViewType.QR_CODE,
        label: t("environments.surveys.summary.qr_code"),
        icon: QrCodeIcon,
        title: t("environments.surveys.summary.qr_code"),
        description: t("environments.surveys.summary.qr_code_description"),
        componentType: QRCodeTab,
        componentProps: { surveyUrl },
      },
      {
        id: ShareViewType.DYNAMIC_POPUP,
        label: t("environments.surveys.share.dynamic_popup.nav_title"),
        icon: SquareStack,
        title: t("environments.surveys.share.dynamic_popup.nav_title"),
        description: t("environments.surveys.share.dynamic_popup.description"),
        componentType: DynamicPopupTab,
        componentProps: { environmentId, surveyId: survey.id },
      },
    ],
    [
      t,
      survey,
      publicDomain,
      setSurveyUrl,
      user.locale,
      surveyUrl,
      environmentId,
      segments,
      isContactsEnabled,
      isFormbricksCloud,
      email,
    ]
  );

  const appTabs = [
    {
      id: ShareViewType.APP,
      label: t("environments.surveys.share.embed_on_website.embed_in_app"),
      icon: SmartphoneIcon,
      title: t("environments.surveys.share.embed_on_website.embed_in_app"),
      componentType: AppTab,
      componentProps: {},
    },
  ];

  const [activeId, setActiveId] = useState(
    survey.type === "link" ? ShareViewType.ANON_LINKS : ShareViewType.APP
  );

  useEffect(() => {
    if (open) {
      setShowView(modalView);
    }
  }, [open, modalView]);

  const handleOpenChange = (open: boolean) => {
    setActiveId(survey.type === "link" ? ShareViewType.ANON_LINKS : ShareViewType.APP);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <VisuallyHidden asChild>
        <DialogTitle />
      </VisuallyHidden>
      <DialogContent
        className="w-full overflow-y-auto bg-white p-0 lg:h-[700px]"
        width="wide"
        aria-describedby={undefined}
        unconstrained>
        {showView === "start" ? (
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
        ) : (
          <ShareView
            tabs={survey.type === "link" ? linkTabs : appTabs}
            activeId={activeId}
            setActiveId={setActiveId}
            survey={survey}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
