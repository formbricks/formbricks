import SecondNavbar from "@/components/environments/SecondNavBar";
import { PresentationChartLineIcon, InboxStackIcon } from "@heroicons/react/24/solid";

interface SurveyResultsTabProps {
  activeId: string;
  environmentId: string;
  surveyId: string;
}

export default function SurveyResultsTab({ activeId, environmentId, surveyId }: SurveyResultsTabProps) {
  const tabs = [
    {
      id: "summary",
      label: "Summary",
      icon: <PresentationChartLineIcon />,
      href: `/environments/${environmentId}/surveys/${surveyId}/summary`,
    },
    {
      id: "responses",
      label: "Responses",
      icon: <InboxStackIcon />,
      href: `/environments/${environmentId}/surveys/${surveyId}/responses`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} />;
}
