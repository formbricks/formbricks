"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Code2Icon,
  CodeIcon,
  Link2Icon,
  MailIcon,
  QrCodeIcon,
  Settings,
  Share2Icon,
  SquareStack,
  UserIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { AnonymousLinksTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/anonymous-links-tab";
import { AppTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/app-tab";
import { CustomHtmlTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/custom-html-tab";
import { DynamicPopupTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/dynamic-popup-tab";
import { EmailTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/email-tab";
import { LinkSettingsTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/link-settings-tab";
import { PersonalLinksTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/personal-links-tab";
import { PrettyUrlTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/pretty-url-tab";
import { QRCodeTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/qr-code-tab";
import { SocialMediaTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/social-media-tab";
import { TabContainer } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container";
import { WebsiteEmbedTab } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/website-embed-tab";
import {
  LinkTabsType,
  ShareSettingsType,
  ShareViaType,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/types/share";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
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
  canManage: boolean;
  isStorageConfigured: boolean;
  workspaceCustomScripts?: string | null;
  enterpriseLicenseRequestFormUrl: string;
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
  canManage,
  isStorageConfigured,
  workspaceCustomScripts,
  enterpriseLicenseRequestFormUrl,
}: Readonly<ShareSurveyModalProps>) => {
  const [surveyUrl, setSurveyUrl] = useState<string>(getSurveyUrl(survey, publicDomain, "default"));
  const [showView, setShowView] = useState<ModalView>(modalView);
  const { email } = user;
  const { t } = useTranslation();
  const linkTabs = useMemo(() => {
    const tabs = [
      {
        id: ShareViaType.ANON_LINKS,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.anonymous_links.nav_title"),
        icon: Link2Icon,
        title: t("workspace.surveys.share.anonymous_links.nav_title"),
        description: t("workspace.surveys.share.anonymous_links.description"),
        content: (
          <AnonymousLinksTab
            survey={survey}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            locale={user.locale}
            surveyUrl={surveyUrl}
            isReadOnly={isReadOnly}
          />
        ),
      },
      {
        id: ShareViaType.PERSONAL_LINKS,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.personal_links.nav_title"),
        icon: UserIcon,
        title: t("workspace.surveys.share.personal_links.nav_title"),
        description: t("workspace.surveys.share.personal_links.description"),
        content: (
          <PersonalLinksTab
            surveyId={survey.id}
            segments={segments}
            isContactsEnabled={isContactsEnabled}
            isFormbricksCloud={isFormbricksCloud}
            enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
          />
        ),
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.WEBSITE_EMBED,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.embed_on_website.nav_title"),
        icon: Code2Icon,
        title: t("workspace.surveys.share.embed_on_website.nav_title"),
        description: t("workspace.surveys.share.embed_on_website.description"),
        content: <WebsiteEmbedTab surveyUrl={surveyUrl} />,
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.EMAIL,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.send_email.nav_title"),
        icon: MailIcon,
        title: t("workspace.surveys.share.send_email.nav_title"),
        description: t("workspace.surveys.share.send_email.description"),
        content: <EmailTab surveyId={survey.id} email={email} />,
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.SOCIAL_MEDIA,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.social_media.title"),
        icon: Share2Icon,
        title: t("workspace.surveys.share.social_media.title"),
        description: t("workspace.surveys.share.social_media.description"),
        content: <SocialMediaTab surveyUrl={surveyUrl} surveyTitle={survey.name} />,
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.QR_CODE,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.summary.qr_code"),
        icon: QrCodeIcon,
        title: t("workspace.surveys.summary.qr_code"),
        description: t("workspace.surveys.summary.qr_code_description"),
        content: <QRCodeTab surveyUrl={surveyUrl} />,
        disabled: survey.singleUse?.enabled,
      },
      {
        id: ShareViaType.DYNAMIC_POPUP,
        type: LinkTabsType.SHARE_VIA,
        label: t("workspace.surveys.share.dynamic_popup.nav_title"),
        icon: SquareStack,
        title: t("workspace.surveys.share.dynamic_popup.nav_title"),
        description: t("workspace.surveys.share.dynamic_popup.description"),
        content: <DynamicPopupTab surveyId={survey.id} />,
      },
      {
        id: ShareSettingsType.LINK_SETTINGS,
        type: LinkTabsType.SHARE_SETTING,
        label: t("workspace.surveys.share.link_settings.title"),
        icon: Settings,
        title: t("workspace.surveys.share.link_settings.title"),
        description: t("workspace.surveys.share.link_settings.description"),
        content: (
          <LinkSettingsTab
            isReadOnly={isReadOnly}
            locale={user.locale}
            isStorageConfigured={isStorageConfigured}
          />
        ),
      },
      {
        id: ShareSettingsType.PRETTY_URL,
        type: LinkTabsType.SHARE_SETTING,
        label: t("workspace.surveys.share.pretty_url.title"),
        icon: Link2Icon,
        title: t("workspace.surveys.share.pretty_url.title"),
        description: t("workspace.surveys.share.pretty_url.description"),
        content: <PrettyUrlTab publicDomain={publicDomain} isReadOnly={isReadOnly} />,
      },
      {
        id: ShareSettingsType.CUSTOM_HTML,
        type: LinkTabsType.SHARE_SETTING,
        label: t("workspace.surveys.share.custom_html.nav_title"),
        icon: CodeIcon,
        title: t("workspace.surveys.share.custom_html.nav_title"),
        description: t("workspace.surveys.share.custom_html.description"),
        // Survey head scripts take Manage access, not the Read & write that `isReadOnly` reflects.
        content: <CustomHtmlTab workspaceCustomScripts={workspaceCustomScripts} isReadOnly={!canManage} />,
      },
    ];

    // Filter out tabs that should not be shown on Formbricks Cloud
    return isFormbricksCloud
      ? tabs.filter(
          (tab) => tab.id !== ShareSettingsType.PRETTY_URL && tab.id !== ShareSettingsType.CUSTOM_HTML
        )
      : tabs;
  }, [
    t,
    survey,
    publicDomain,
    user.locale,
    surveyUrl,
    isReadOnly,
    canManage,
    segments,
    isContactsEnabled,
    isFormbricksCloud,
    email,
    isStorageConfigured,
    workspaceCustomScripts,
    enterpriseLicenseRequestFormUrl,
  ]);

  const getDefaultActiveId = useCallback(() => {
    if (survey.type !== "link") {
      return ShareViaType.APP;
    }

    return ShareViaType.ANON_LINKS;
  }, [survey.type]);

  const [activeId, setActiveId] = useState<ShareViaType | ShareSettingsType>(getDefaultActiveId());

  // Opening the modal (or asking an open one for another view) shows the requested view. Adjusted
  // during render, so the first frame after opening already shows it.
  const requestedView = open ? modalView : null;
  const [appliedRequestedView, setAppliedRequestedView] = useState(requestedView);
  if (requestedView !== appliedRequestedView) {
    setAppliedRequestedView(requestedView);
    if (requestedView) setShowView(requestedView);
  }

  // Never show a disabled tab: fall back to the default while the chosen one is disabled.
  const isActiveTabDisabled = linkTabs.find((tab) => tab.id === activeId)?.disabled ?? false;
  const visibleActiveId = isActiveTabDisabled ? getDefaultActiveId() : activeId;

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
      return <ShareView tabs={linkTabs} activeId={visibleActiveId} setActiveId={setActiveId} />;
    }

    return (
      <div className={`h-full w-full rounded-lg bg-slate-50 p-6`}>
        <TabContainer
          title={t("workspace.surveys.summary.in_app.title")}
          description={t("workspace.surveys.summary.in_app.description")}>
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
