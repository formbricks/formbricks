"use client";

import { AnonymousLinksTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/anonymous-links-tab";
import { AppTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/app-tab";
import { DynamicPopupTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/dynamic-popup-tab";
import { EmailTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/email-tab";
import { LinkSettingsTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/link-settings-tab";
import { PersonalLinksTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/personal-links-tab";
import { QRCodeTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/qr-code-tab";
import { SocialMediaTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/social-media-tab";
import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container";
import { WebsiteEmbedTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/website-embed-tab";
import {
  LinkTabsType,
  ShareSettingsType,
  ShareViaType,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/types/share";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslate } from "@tolgee/react";
import {
  Code2Icon,
  LinkIcon,
  MailIcon,
  QrCodeIcon,
  Settings,
  Share2Icon,
  SquareStack,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  isReadOnly: boolean;
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
  isReadOnly,
}: ShareSurveyModalProps) => {
  const environmentId = survey.environmentId;
  const [surveyUrl, setSurveyUrl] = useState<string>(getSurveyUrl(survey, publicDomain, "default"));
  const [showView, setShowView] = useState<ModalView>(modalView);
  const { email } = user;
  const { t } = useTranslate();
  const linkTabs: {
    id: ShareViaType | ShareSettingsType;
    type: LinkTabsType;
    label: string;
    icon: React.ElementType;
    title: string;
    description: string;
    componentType: React.ComponentType<unknown>;
    componentProps: unknown;
    disabled?: boolean;
  }[] = useMemo(
    () => [
      {
        id: ShareViaType.ANON_LINKS,
        type: LinkTabsType.SHARE_VIA,
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
          isReadOnly,
        },
      },
      {
        id: ShareViaType.PERSONAL_LINKS,
        type: LinkTabsType.SHARE_VIA,
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
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.WEBSITE_EMBED,
        type: LinkTabsType.SHARE_VIA,
        label: t("environments.surveys.share.embed_on_website.nav_title"),
        icon: Code2Icon,
        title: t("environments.surveys.share.embed_on_website.nav_title"),
        description: t("environments.surveys.share.embed_on_website.description"),
        componentType: WebsiteEmbedTab,
        componentProps: { surveyUrl },
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.EMAIL,
        type: LinkTabsType.SHARE_VIA,
        label: t("environments.surveys.share.send_email.nav_title"),
        icon: MailIcon,
        title: t("environments.surveys.share.send_email.nav_title"),
        description: t("environments.surveys.share.send_email.description"),
        componentType: EmailTab,
        componentProps: { surveyId: survey.id, email },
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.SOCIAL_MEDIA,
        type: LinkTabsType.SHARE_VIA,
        label: t("environments.surveys.share.social_media.title"),
        icon: Share2Icon,
        title: t("environments.surveys.share.social_media.title"),
        description: t("environments.surveys.share.social_media.description"),
        componentType: SocialMediaTab,
        componentProps: { surveyUrl, surveyTitle: survey.name },
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.QR_CODE,
        type: LinkTabsType.SHARE_VIA,
        label: t("environments.surveys.summary.qr_code"),
        icon: QrCodeIcon,
        title: t("environments.surveys.summary.qr_code"),
        description: t("environments.surveys.summary.qr_code_description"),
        componentType: QRCodeTab,
        componentProps: { surveyUrl },
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.DYNAMIC_POPUP,
        type: LinkTabsType.SHARE_VIA,
        label: t("environments.surveys.share.dynamic_popup.nav_title"),
        icon: SquareStack,
        title: t("environments.surveys.share.dynamic_popup.nav_title"),
        description: t("environments.surveys.share.dynamic_popup.description"),
        componentType: DynamicPopupTab,
        componentProps: { environmentId, surveyId: survey.id },
      },
      {
        id: ShareSettingsType.LINK_SETTINGS,
        type: LinkTabsType.SHARE_SETTING,
        label: t("environments.surveys.share.link_settings.title"),
        icon: Settings,
        title: t("environments.surveys.share.link_settings.title"),
        description: t("environments.surveys.share.link_settings.description"),
        componentType: LinkSettingsTab,
        componentProps: { isReadOnly, locale: user.locale },
      },
    ],
    [
      t,
      survey,
      publicDomain,
      user.locale,
      surveyUrl,
      isReadOnly,
      environmentId,
      segments,
      isContactsEnabled,
      isFormbricksCloud,
      email,
    ]
  );

  const getDefaultActiveId = useCallback(() => {
    if (survey.type !== "link") {
      return ShareViaType.APP;
    }

    return ShareViaType.ANON_LINKS;
  }, [survey.type]);

  const [activeId, setActiveId] = useState<ShareViaType | ShareSettingsType>(getDefaultActiveId());

  useEffect(() => {
    if (open) {
      setShowView(modalView);
    }
  }, [open, modalView]);

  // Ensure active tab is not disabled - if it is, switch to default
  useEffect(() => {
    const activeTab = linkTabs.find((tab) => tab.id === activeId);
    if (activeTab?.disabled) {
      setActiveId(getDefaultActiveId());
    }
  }, [activeId, linkTabs, getDefaultActiveId]);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setShowView("start");
      setActiveId(getDefaultActiveId());
    }
  };

  const handleViewChange = (view: ModalView) => {
    setShowView(view);
  };

  const handleEmbedViewWithTab = (tabId: ShareViaType | ShareSettingsType) => {
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
          isReadOnly={isReadOnly}
        />
      );
    }

    if (survey.type === "link") {
      return <ShareView tabs={linkTabs} activeId={activeId} setActiveId={setActiveId} />;
    }

    return (
      <div className={`h-full w-full rounded-lg bg-slate-50 p-6`}>
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
      <DialogContent
        className="w-full bg-white p-0 lg:h-[700px]"
        width={survey.type === "link" ? "wide" : "default"}
        aria-describedby={undefined}
        unconstrained>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
