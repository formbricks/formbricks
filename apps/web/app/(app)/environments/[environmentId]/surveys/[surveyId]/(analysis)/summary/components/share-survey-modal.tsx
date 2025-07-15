"use client";

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
  const { email } = user;
  const { t } = useTranslate();
  const linkTabs: { id: ShareViewType; label: string; icon: React.ElementType }[] = useMemo(
    () => [
      {
        id: ShareViewType.ANON_LINKS,
        label: t("environments.surveys.share.anonymous_links.nav_title"),
        icon: LinkIcon,
      },
      {
        id: ShareViewType.QR_CODE,
        label: t("environments.surveys.summary.qr_code"),
        icon: QrCodeIcon,
      },
      {
        id: ShareViewType.PERSONAL_LINKS,
        label: t("environments.surveys.share.personal_links.nav_title"),
        icon: UserIcon,
      },
      {
        id: ShareViewType.EMAIL,
        label: t("environments.surveys.share.send_email.nav_title"),
        icon: MailIcon,
      },
      {
        id: ShareViewType.WEBSITE_EMBED,
        label: t("environments.surveys.share.embed_on_website.nav_title"),
        icon: Code2Icon,
      },
      {
        id: ShareViewType.DYNAMIC_POPUP,
        label: t("environments.surveys.share.dynamic_popup.nav_title"),
        icon: SquareStack,
      },
    ],
    [t]
  );

  const appTabs = [
    {
      id: ShareViewType.APP,
      label: t("environments.surveys.share.embed_on_website.embed_in_app"),
      icon: SmartphoneIcon,
    },
  ];

  const [activeId, setActiveId] = useState(
    survey.type === "link" ? ShareViewType.ANON_LINKS : ShareViewType.APP
  );

  const [surveyUrl, setSurveyUrl] = useState(() => getSurveyUrl(survey, publicDomain, "default"));
  const [showView, setShowView] = useState<ModalView>(modalView);

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
