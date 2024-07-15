"use client";

import { BellRing, BlocksIcon, Code2Icon, LinkIcon, MailIcon, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { Badge } from "@formbricks/ui/Badge";
import { Dialog, DialogContent } from "@formbricks/ui/Dialog";
import { ShareSurveyLink } from "@formbricks/ui/ShareSurveyLink";
import { EmbedView } from "./shareEmbedModal/EmbedView";
import { PanelInfoView } from "./shareEmbedModal/PanelInfoView";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  webAppUrl: string;
  user: TUser;
}

export const ShareEmbedSurvey = ({ survey, open, setOpen, webAppUrl, user }: ShareEmbedSurveyProps) => {
  const router = useRouter();
  const environmentId = survey.environmentId;
  const isSingleUseLinkSurvey = survey.singleUse?.enabled ?? false;
  const { email } = user;

  const tabs = [
    { id: "email", label: "Embed in an Email", icon: MailIcon },
    { id: "webpage", label: "Embed in a Web Page", icon: Code2Icon },
    { id: "link", label: `${isSingleUseLinkSurvey ? "Single Use Links" : "Share the Link"}`, icon: LinkIcon },
  ];

  const [activeId, setActiveId] = useState(tabs[0].id);
  const [showView, setShowView] = useState("start");
  const [surveyUrl, setSurveyUrl] = useState("");

  const handleOpenChange = (open: boolean) => {
    setActiveId(tabs[0].id);
    setOpen(open);
    setShowView(open ? "start" : ""); // Reset to initial page when modal opens or closes

    // fetch latest responses
    router.refresh();
  };

  const handleInitialPageButton = () => {
    setShowView("start");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-xl bg-white p-0 md:max-w-3xl lg:h-[700px] lg:max-w-5xl">
        {showView === "start" ? (
          <div className="h-full max-w-full overflow-hidden">
            <div className="flex h-[200px] w-full flex-col items-center justify-center space-y-6 p-8 text-center lg:h-2/5">
              <p className="pt-2 text-xl font-semibold text-slate-800">Your survey is public 🎉</p>
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
                  href={`/environments/${environmentId}//settings/notifications`}
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
            tabs={tabs}
            activeId={activeId}
            setActiveId={setActiveId}
            survey={survey}
            email={email}
            surveyUrl={surveyUrl}
            setSurveyUrl={setSurveyUrl}
            webAppUrl={webAppUrl}
          />
        ) : showView === "panel" ? (
          <PanelInfoView handleInitialPageButton={handleInitialPageButton} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
