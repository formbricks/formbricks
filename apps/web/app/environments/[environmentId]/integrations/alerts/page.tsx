import Card from "@/components/ui/Card";
import PageTitle from "@/components/ui/PageTitle";
import { EmailIcon } from "@/components/ui/icons/EmailIcon";
import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";

export default function EventsAttributesPage({ params }) {
  return (
    <div>
      <PageTitle>Team Alerts</PageTitle>
      <div className="grid grid-cols-3 gap-6">
        <Card
          href={`/environments/${params.environmentId}/integrations/alerts/email`}
          title="Email Notifications"
          description="Keep your team in the loop with email notifications."
          icon={<EmailIcon />}
        />
        <Card
          href={`/environments/${params.environmentId}/integrations/alerts/slack`}
          title="Slack"
          description="Surface insights in dedicated Slack channels."
          icon={<Image src={SlackLogo} alt="Slack Logo" />}
        />
      </div>
    </div>
  );
}
