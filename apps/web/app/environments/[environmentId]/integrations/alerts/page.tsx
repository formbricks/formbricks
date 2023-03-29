import { Card } from "@formbricks/ui";
import { EmailIcon } from "@formbricks/ui";
import { PageTitle } from "@formbricks/ui";
import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";
import Link from "next/link";

export default function EventsAttributesPage({ params }) {
  return (
    <div>
      <PageTitle>Team Alerts</PageTitle>
      <div className="grid grid-cols-3 gap-6">
        {/*         <Card
          href={`/environments/${params.environmentId}/integrations/alerts/email`}
          title="Email Notifications"
          description="Keep your team in the loop with email notifications."
          icon={<EmailIcon />}
        /> */}
        <Card
          href={`/environments/${params.environmentId}/integrations/alerts/slack`}
          title="Slack"
          description="Surface insights in dedicated Slack channels."
          icon={<Image src={SlackLogo} alt="Slack Logo" />}
        />
        <Link
          href={`/environments/${params.environmentId}/settings/notifications`}
          className="hover:ring-brand-dark cursor-pointer rounded-lg bg-slate-100 p-8 text-left shadow-sm  transition-all duration-150 ease-in-out hover:ring-1">
          <div className="mb-6 h-8 w-8">
            <EmailIcon />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Looking for email?</h3>
          <p className="text-xs text-slate-500">Change your notification settings.</p>
        </Link>
      </div>
    </div>
  );
}
