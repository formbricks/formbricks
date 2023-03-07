import SecondNavbar from "../environments/SecondNavBar";

interface PeopleGroupTabs {
  activeId: string;
  environmentId: string;
}

export default function PeopleGroupsTabs({ activeId, environmentId }: PeopleGroupTabs) {
  const tabs = [
    { id: "people", name: "People", href: `/environments/${environmentId}/people` },
    { id: "groups", name: "Groups", href: `/environments/${environmentId}/groups` },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
