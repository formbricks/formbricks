import SecondNavbar from "@/components/environments/SecondNavBar";
import { CursorArrowRaysIcon, TagIcon } from "@heroicons/react/24/solid";

interface ActionsAttributesTabsProps {
  activeId: string;
  environmentId: string;
}

export default function ActionsAttributesTabs({ activeId, environmentId }: ActionsAttributesTabsProps) {
  const tabs = [
    {
      id: "actions",
      label: "Actions",
      icon: <CursorArrowRaysIcon />,
      href: `/environments/${environmentId}/actions`,
    },
    {
      id: "attributes",
      label: "Attributes",
      icon: <TagIcon />,
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
