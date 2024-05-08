import { TagIcon, UserIcon, UsersIcon } from "lucide-react";

import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface PeopleSegmentsTabsProps {
  activeId: string;
  environmentId: string;
  isUserTargetingAllowed?: boolean;
}

export default function PeopleSegmentsTabs({ activeId, environmentId }: PeopleSegmentsTabsProps) {
  const navigation = [
    {
      id: "people",
      label: "People",
      icon: <UserIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/people`,
      current: activeId === "people",
    },
    {
      id: "segments",
      label: "Segments",
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/segments`,
      current: activeId === "segments",
    },
    {
      id: "attributes",
      label: "Attributes",
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/attributes`,
      current: activeId === "attributes",
    },
  ];

  return <SecondaryNavigation navigation={navigation} />;
}
