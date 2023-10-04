import JsLogo from "@/images/jslogo.png";
import WebhookLogo from "@/images/webhook.png";
import ZapierLogo from "@/images/zapier-small.png";
import GoogleSheetsLogo from "@/images/google-sheets-small.png";
import n8nLogo from "@/images/n8n.png";
import MakeLogo from "@/images/make-small.png";
import { Card } from "@formbricks/ui";
import Image from "next/image";
import { getIntegrations } from "@formbricks/lib/services/integrations";

export default async function IntegrationsPage({ params }) {
  const integrations = await getIntegrations(params.environmentId);
  const containsGoogleSheetIntegration = integrations.some(
    (integration) => integration.type === "googleSheets"
  );

  const containsAirTableIntegration = integrations.some((integration) => integration.type === "airtable");

  return (
    <div>
      <h1 className="my-2 text-3xl font-bold text-slate-800">Integrations</h1>
      <p className="mb-6 text-slate-500">Connect Formbricks with your favorite tools.</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          docsHref="https://formbricks.com/docs/getting-started/framework-guides#next-js"
          docsText="Docs"
          docsNewTab={true}
          label="Javascript Widget"
          description="Integrate Formbricks into your Webapp"
          icon={<Image src={JsLogo} alt="Javascript Logo" />}
        />
        <Card
          docsHref="https://formbricks.com/docs/integrations/zapier"
          docsText="Docs"
          docsNewTab={true}
          connectHref="https://zapier.com/apps/formbricks/integrations"
          connectText="Connect"
          connectNewTab={true}
          label="Zapier"
          description="Integrate Formbricks with 5000+ apps via Zapier"
          icon={<Image src={ZapierLogo} alt="Zapier Logo" />}
        />
        <Card
          connectHref={`/environments/${params.environmentId}/integrations/webhooks`}
          connectText="Manage Webhooks"
          connectNewTab={false}
          docsHref="https://formbricks.com/docs/webhook-api/overview"
          docsText="Docs"
          docsNewTab={true}
          label="Webhooks"
          description="Trigger Webhooks based on actions in your surveys"
          icon={<Image src={WebhookLogo} alt="Webhook Logo" />}
        />
        <Card
          connectHref={`/environments/${params.environmentId}/integrations/google-sheets`}
          connectText={`${containsGoogleSheetIntegration ? "Manage Sheets" : "Connect"}`}
          connectNewTab={false}
          docsHref="https://formbricks.com/docs/integrations/google-sheets"
          docsText="Docs"
          docsNewTab={true}
          label="Google Sheets"
          description="Instantly populate your spreadsheets with survey data"
          icon={<Image src={GoogleSheetsLogo} alt="Google sheets Logo" />}
        />
        <Card
          connectHref={`/environments/${params.environmentId}/integrations/airtable`}
          connectText={`${containsAirTableIntegration ? "Manage Table" : "Connect"}`}
          connectNewTab={false}
          docsHref="https://formbricks.com/docs/integrations/airtable"
          docsText="Docs"
          docsNewTab={true}
          label="Airtable"
          description="Instantly populate your airtable table with survey data"
          icon={<Image src={GoogleSheetsLogo} alt="Google sheets Logo" />}
        />
        <Card
          docsHref="https://formbricks.com/docs/integrations/n8n"
          docsText="Docs"
          docsNewTab={true}
          connectHref="https://n8n.io"
          connectText="Connect"
          connectNewTab={true}
          label="n8n"
          description="Integrate Formbricks with 350+ apps via n8n"
          icon={<Image src={n8nLogo} alt="n8n Logo" />}
        />
        <Card
          docsHref="https://formbricks.com/docs/integrations/make"
          docsText="Docs"
          docsNewTab={true}
          connectHref="https://www.make.com/en/integrations/formbricks"
          connectText="Connect"
          connectNewTab={true}
          label="Make.com"
          description="Integrate Formbricks with 1000+ apps via Make"
          icon={<Image src={MakeLogo} alt="Make Logo" />}
        />
      </div>
    </div>
  );
}
