import SecondNavbar from "../environments/SecondNavBar";
import { UserIcon, UserGroupIcon } from "@heroicons/react/24/solid";

interface PeopleGroupTabs {
  activeId: string;
  environmentId: string;
}

export default function PeopleGroupsTabs({ activeId, environmentId }: PeopleGroupTabs) {
  const tabs = [
    { id: "people", label: "People", icon: <UserIcon />, href: `/environments/${environmentId}/people` },
    { id: "groups", label: "Groups", icon: <UserGroupIcon />, href: `/environments/${environmentId}/groups` },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} />;
}
