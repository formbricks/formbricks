"use client";

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
import { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { Badge } from "@formbricks/ui/components/Badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@formbricks/ui/components/Dialog";
import { ShareSurveyLink } from "@formbricks/ui/components/ShareSurveyLink";
import { EmbedView } from "./shareEmbedModal/EmbedView";
import { PanelInfoView } from "./shareEmbedModal/PanelInfoView";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  modalView: "start" | "embed" | "panel";
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  webAppUrl: string;
  user: TUser;
}

export const ShareEmbedSurvey = ({
  survey,
  open,
  modalView,
  setOpen,
  webAppUrl,
  user,
}: ShareEmbedSurveyProps) => {
  const router = useRouter();
  const environmentId = survey.environmentId;
  const isSingleUseLinkSurvey = survey.singleUse?.enabled ?? false;
  const { email } = user;

  const tabs = [
    { id: "email", label: "Embed in an email", icon: MailIcon },
    { id: "webpage", label: "Embed on website", icon: Code2Icon },
    { id: "link", label: `${isSingleUseLinkSurvey ? "Single use links" : "Share the link"}`, icon: LinkIcon },
    { id: "app", label: "Embed in app", icon: SmartphoneIcon },
  ].filter((tab) => !(survey.type === "link" && tab.id === "app"));

  const [activeId, setActiveId] = useState(survey.type === "link" ? tabs[0].id : tabs[3].id);
  const [showView, setShowView] = useState<"start" | "embed" | "panel">("start");
  const [surveyUrl, setSurveyUrl] = useState("");

  useEffect(() => {
    if (survey.type !== "link") {
      setActiveId(tabs[3].id);
    }
  }, [survey.type]);

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
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-xl bg-white p-0 md:max-w-3xl lg:h-[700px] lg:max-w-5xl">
        {showView === "start" ? (
          <div className="h-full max-w-full overflow-hidden">
            <div className="flex h-[200px] w-full flex-col items-center justify-center space-y-6 p-8 text-center lg:h-2/5">
              <DialogTitle>
                <p className="pt-2 text-xl font-semibold text-slate-800">Your survey is public 🎉</p>
              </DialogTitle>
              <DialogDescription className="hidden" />
              <ShareSurveyLink
                survey={survey}
                webAppUrl={webAppUrl}
                surveyUrl={surveyUrl}
                setSurveyUrl={setSurveyUrl}
              />
            </div>
            <div className="flex h-[300px] flex-col items-center justify-center gap-8 rounded-b-lg bg-slate-50 px-8 lg:h-3/5">
              <p className="-mt-8 text-sm text-slate-500">What&apos;s next?</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setShowView("embed")}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <Code2Icon className="h-6 w-6 text-slate-700" />
                  Embed survey
                </button>
                <Link
                  href={`/environments/${environmentId}/settings/notifications`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BellRing className="h-6 w-6 text-slate-700" />
                  Configure alerts
                </Link>
                <Link
                  href={`/environments/${environmentId}/integrations`}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <BlocksIcon className="h-6 w-6 text-slate-700" />
                  Setup integrations
                </Link>
                <button
                  type="button"
                  onClick={() => setShowView("panel")}
                  className="relative flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 hover:border-slate-200 md:p-8">
                  <UsersRound className="h-6 w-6 text-slate-700" />
                  Send to panel
                  <Badge size="tiny" type="success" text="New" className="absolute right-3 top-3" />
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
            setSurveyUrl={setSurveyUrl}
            webAppUrl={webAppUrl}
          />
        ) : showView === "panel" ? (
          <PanelInfoView handleInitialPageButton={handleInitialPageButton} disableBack={false} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
