import { Card, PageTitle } from "@formbricks/ui";
import Image from "next/image";
import JsLogo from "@/images/jslogo.png";

export default function IntegrationsPage({ params }) {
  return (
    <div>
      <PageTitle>Integrations</PageTitle>
      <div className="grid grid-cols-3 gap-6">
        <Card
          href={`/environments/${params.environmentId}/integrations/js`}
          title="Javascript Widget"
          description="Integrate Formbricks into your Webapp"
          icon={<Image src={JsLogo} alt="Javascript Logo" />}
        />
      </div>
    </div>
  );
}
