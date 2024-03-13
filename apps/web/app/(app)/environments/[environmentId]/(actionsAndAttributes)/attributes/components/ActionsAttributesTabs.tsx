import SecondNavbar from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/SecondNavbar";
import { MousePointerClickIcon, TagIcon } from "lucide-react";

interface ActionsAttributesTabsProps {
  activeId: string;
  environmentId: string;
}

export default function ActionsAttributesTabs({ activeId, environmentId }: ActionsAttributesTabsProps) {
  const tabs = [
    {
      id: "actions",
      label: "Actions",
      icon: <MousePointerClickIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/actions`,
    },
    {
      id: "attributes",
      label: "Attributes",
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
