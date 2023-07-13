import { Card } from "@formbricks/ui";
import Image from "next/image";
import JsLogo from "@/images/jslogo.png";
import ZapierLogo from "@/images/zapier-small.png";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="my-2 text-3xl font-bold text-slate-800">Integrations</h1>
      <p className="mb-6 text-slate-500">Connect Formbricks with your favorite tools.</p>
      <div className="grid grid-cols-3 gap-6">
        <Card
          docsHref="https://formbricks.com/docs/getting-started/nextjs-app"
          label="Javascript Widget"
          description="Integrate Formbricks into your Webapp"
          icon={<Image src={JsLogo} alt="Javascript Logo" />}
        />
        <Card
          docsHref="https://formbricks.com/docs/integrations/zapier"
          connectHref="https://zapier.com/apps/formbricks/integrations"
          label="Zapier"
          description="Integrate Formbricks with 5000+ apps via Zapier"
          icon={<Image src={ZapierLogo} alt="Zapier Logo" />}
        />
      </div>
    </div>
  );
}
