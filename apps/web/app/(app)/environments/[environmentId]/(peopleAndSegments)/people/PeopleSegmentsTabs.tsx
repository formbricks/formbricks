import SecondNavbar from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/SecondNavbar";
import { UserGroupIcon, UserIcon } from "@heroicons/react/24/solid";

interface PeopleSegmentsTabsProps {
  activeId: string;
  environmentId: string;
}

export default function PeopleSegmentsTabs({ activeId, environmentId }: PeopleSegmentsTabsProps) {
  const tabs = [
    {
      id: "people",
      label: "People",
      icon: <UserIcon />,
      href: `/environments/${environmentId}/people`,
    },
    {
      id: "segments",
      label: "Segments",
      icon: <UserGroupIcon />,
      href: `/environments/${environmentId}/segments`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
