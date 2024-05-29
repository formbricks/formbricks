import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface PeopleSegmentsTabsProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const PeopleSecondaryNavigation = ({ activeId, environmentId, loading }: PeopleSegmentsTabsProps) => {
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

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
