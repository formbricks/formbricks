import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface PeopleSegmentsTabsProps {
  activeId: string;
  environmentId: string;
}

export const PeopleSecondaryNavigation = ({ activeId, environmentId }: PeopleSegmentsTabsProps) => {
  const navigation = [
    {
      id: "people",
      label: "People",
      href: `/environments/${environmentId}/people`,
    },
    {
      id: "segments",
      label: "Segments",
      href: `/environments/${environmentId}/segments`,
    },
    {
      id: "attributes",
      label: "Attributes",
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
