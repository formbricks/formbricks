"use client";

import { AddAlertButton } from "@/components/integrations/AddAlertButton";
import AlertCard from "@/components/integrations/AlertCard";
import IntegrationPageTitle from "@/components/integrations/IntegrationsPageTitle";
import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";

export default function SlackAlertPage({ params }) {
  const exampleAlert = {
    href: "/",
    title: "Example Alert",
    description: "This is an example alert",
  };

  function myFunction() {
    console.log("TEST");
  }

  return (
    <div>
      <IntegrationPageTitle environmentId={params.environmentId} title="Slack Alerts" goBackTo="alerts" />
      <div className="grid grid-cols-3 gap-6">
        <AlertCard
          onDelete={myFunction}
          onEdit={myFunction}
          href={exampleAlert.href}
          title={exampleAlert.title}
          description={exampleAlert.description}
          icon={<Image src={SlackLogo} alt="Slack Logo" />}
        />
        <AddAlertButton channel="Slack" onClick={myFunction} />
      </div>
    </div>
  );
}
