import SecondNavbar from "../environments/SecondNavBar";
import { CursorArrowRaysIcon, TagIcon } from "@heroicons/react/20/solid";

interface PeopleGroupTabs {
  activeId: string;
  environmentId: string;
}

export default function PeopleGroupsTabs({ activeId, environmentId }: PeopleGroupTabs) {
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
