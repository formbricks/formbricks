import EmailTab from "./shareEmbedTabs/EmailTab";
import LinkTab from "./shareEmbedTabs/LinkTab";
import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/v1/product";
import { TProfile } from "@formbricks/types/v1/profile";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button, Sheet, SheetContent, SheetHeader } from "@formbricks/ui";
import { useState } from "react";

interface EmbedSurveySheetProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyUrl: string;
  product: TProduct;
  profile: TProfile;
}

export default function EmbedSurveySheet({
  survey,
  open,
  setOpen,
  surveyUrl,
  product,
  profile,
}: EmbedSurveySheetProps) {
  const [activeId, setActiveId] = useState("link");

  const componentMap = {
    link: <LinkTab surveyUrl={surveyUrl} survey={survey} product={product} />,
    email: <EmailTab survey={survey} surveyUrl={surveyUrl} profile={profile} product={product} />,
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className="over flex h-[90%] w-full flex-col gap-0 rounded-t-2xl bg-slate-50 p-0"
        side={"bottom"}>
        <SheetHeader>
          <div className="border-b border-gray-200 px-6 py-4">Share or embed your survey</div>
        </SheetHeader>
        <div className="flex grow flex-col gap-6 overflow-y-scroll px-4 py-6">
          <div className="tab grow overflow-y-scroll">{componentMap[activeId]}</div>
          <div className="mx-auto flex max-w-max rounded-md bg-slate-100 p-1">
            {tabs.map((tab) => (
              <Button
                variant="minimal"
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={cn(
                  "rounded-sm px-3 py-[6px]",
                  tab.id === activeId
                    ? "bg-white text-slate-900"
                    : "border-transparent text-slate-700 hover:text-slate-900"
                )}>
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const tabs = [
  { id: "link", label: "Share Link" },
  { id: "email", label: "Embed in an Email" },
];
