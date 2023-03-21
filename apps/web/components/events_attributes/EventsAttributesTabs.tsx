import SecondNavbar from "../environments/SecondNavBar";
import { CursorArrowRaysIcon, TagIcon } from "@heroicons/react/24/solid";

interface EventsAttributesTabsProps {
  activeId: string;
  environmentId: string;
}

export default function EventsAttributesTabs({ activeId, environmentId }: EventsAttributesTabsProps) {
  const tabs = [
    {
      id: "events",
      label: "Events",
      icon: <CursorArrowRaysIcon />,
      href: `/environments/${environmentId}/events`,
    },
    {
      id: "attributes",
      label: "Attributes",
      icon: <TagIcon />,
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} />;
}
