import SecondNavbar from "../environments/SecondNavBar";
import { CodeBracketSquareIcon, MegaphoneIcon, ArrowPathIcon } from "@heroicons/react/24/solid";

interface IntegrationsTabs {
  activeId: string;
  environmentId: string;
}

export default function PeopleGroupsTabs({ activeId, environmentId }: IntegrationsTabs) {
  const tabs = [
    {
      id: "installation",
      label: "Installation",
      icon: <CodeBracketSquareIcon />,
      href: `/environments/${environmentId}/integrations/installation`,
    },
    {
      id: "alerts",
      label: "Team Alerts",
      icon: <MegaphoneIcon />,
      href: `/environments/${environmentId}/integrations/alerts`,
    },
    {
      id: "data",
      label: "Data Sync",
      icon: <ArrowPathIcon />,
      href: `/environments/${environmentId}/integrations/data`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} />;
}
