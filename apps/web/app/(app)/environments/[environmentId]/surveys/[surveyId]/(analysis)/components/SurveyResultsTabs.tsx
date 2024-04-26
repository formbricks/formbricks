import revalidateSurveyIdPath from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { InboxIcon, PresentationIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { cn } from "@formbricks/lib/cn";

interface SurveyResultsTabProps {
  activeId: string;
  environmentId: string;
  surveyId: string;
  responseCount: number | null;
}

export const SurveyResultsTabs = ({
  activeId,
  environmentId,
  surveyId,
  responseCount,
}: SurveyResultsTabProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const url = isSharingPage ? `/share/${sharingKey}` : `/environments/${environmentId}/surveys/${surveyId}`;

  const tabs = [
    {
      id: "summary",
      label: "Summary",
      icon: <PresentationIcon className="h-5 w-5" />,
      href: `${url}/summary?referer=true`,
    },
    {
      id: "responses",
      label: `Responses ${responseCount !== null ? `(${responseCount})` : ""}`,
      icon: <InboxIcon className="h-5 w-5" />,
      href: `${url}/responses?referer=true`,
    },
  ];

  return (
    <div>
      <div className="mb-7 h-14 w-full border-b">
        <nav className="flex h-full items-center space-x-4 justify-self-center" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              onClick={() => {
                revalidateSurveyIdPath(environmentId, surveyId);
              }}
              href={tab.href}
              className={cn(
                tab.id === activeId
                  ? " border-brand-dark text-brand-dark border-b-2 font-semibold"
                  : "text-slate-500 hover:text-slate-700",
                "flex h-full items-center px-3 text-sm font-medium"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="mr-2 h-5 w-5">{tab.icon}</div>}
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};
