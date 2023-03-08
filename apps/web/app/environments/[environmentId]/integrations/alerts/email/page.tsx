"use client";

import { AddAlertButton } from "@/components/integrations/AddAlertButton";
import AlertCard from "@/components/integrations/AlertCard";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import { EmailIcon } from "@/components/ui/icons/EmailIcon";

export default function SlackAlertPage({ params }) {
  const exampleAlert = {
    href: "/",
    title: "Example Alert",
    description: "This is an example alert",
  };

  function myFunction() {
    console.log();
  }

  return (
    <div>
      <IntegrationPageTitle environmentId={params.environmentId} title="Email Alerts" goBackTo="alerts" />
      <div className="grid grid-cols-3 gap-6">
        <AlertCard
          onDelete={myFunction}
          onEdit={myFunction}
          href={exampleAlert.href}
          title={exampleAlert.title}
          description={exampleAlert.description}
          icon={<EmailIcon />}
        />
        <AddAlertButton channel="Email" onclick={myFunction} />
      </div>
    </div>
  );
}
