import EmbedSurveyModal, {
  EmailTab,
  LinkTab,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/EmbedSurveyModal";
import { useProfile } from "@/lib/profile";
import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { SheetContent, SheetHeader, Sheet, Button } from "@formbricks/ui";
import { useMemo, useState } from "react";

interface ShareEmbedSurveyProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyBaseUrl: string;
  product: TProduct;
}

export default function ShareEmbedSurvey({
  survey,
  open,
  setOpen,
  surveyBaseUrl,
  product,
}: ShareEmbedSurveyProps) {
  const surveyUrl = useMemo(() => surveyBaseUrl + survey.id, [survey]);
  const { profile } = useProfile();

  console.log({ survey, open, setOpen, surveyBaseUrl, product });
  return (
    <div className="">
      <div className="hidden lg:hidden">
        {/* <EmbedSurveyModal
          survey={survey}
          open={open}
          setOpen={setOpen}
          product={product}
          surveyBaseUrl={surveyBaseUrl}
          profile = {profile}
        /> */}
      </div>
      <div className="invisible hidden lg:hidden">
        <EmbedSurveySheet
          survey={survey}
          open={open}
          setOpen={setOpen}
          product={product}
          surveyUrl={surveyUrl}
          profile={profile}
        />
      </div>
    </div>
  );
}

const EmbedSurveySheet = ({ survey, open, setOpen, surveyUrl, product, profile }) => {
  const [activeId, setActiveId] = useState("link");

  const tabs = [
    { id: "link", label: "Share Link" },
    { id: "email", label: "Embed in an Email" },
  ];
  const componentMap = {
    link: <LinkTab surveyUrl={surveyUrl} survey={survey} product={product} />,
    email: <EmailTab survey={survey} surveyUrl={surveyUrl} profile={profile} />,
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
};
