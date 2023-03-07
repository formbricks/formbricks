import SecondNavbar from "../environments/SecondNavBar";

interface IntegrationsTabs {
  activeId: string;
  environmentId: string;
}

export default function PeopleGroupsTabs({ activeId, environmentId }: IntegrationsTabs) {
  const tabs = [
    {
      id: "installation",
      name: "Installation",
      href: `/environments/${environmentId}/integrations/installation`,
    },
    { id: "alerts", name: "Team Alerts", href: `/environments/${environmentId}/integrations/alerts` },
    { id: "data", name: "Data Sync", href: `/environments/${environmentId}/integrations/data` },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
