import ZapierLogo from "@/images/zapier-small.png";
import Image from "next/image";
import IntegrationPageTitle from "../IntegrationsPageTitle";

export default function JsIntegrationPage({ params }) {
  return (
    <div>
      <IntegrationPageTitle
        environmentId={params.environmentId}
        title="Zapier Integration"
        icon={<Image src={ZapierLogo} alt="Zapier Logo" />}
      />
    </div>
  );
}
