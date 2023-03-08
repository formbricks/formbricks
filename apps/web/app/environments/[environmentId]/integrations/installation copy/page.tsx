import Card from "@/components/ui/Card";
import PageTitle from "@/components/ui/PageTitle";
import JSLogo from "@/images/jslogo.png";
import NPMLogo from "@/images/npmlogo.png";
import Image from "next/image";
/*  */
export default function EventsAttributesPage({ params }) {
  return (
    <div>
      <PageTitle>Installation</PageTitle>
      <div className="grid grid-cols-3 gap-6">
        <Card
          href={`/environments/${params.environmentId}/integrations/installation/javascript`}
          title="JavaScript"
          description="Copy the Formbricks snippet into your HTML <head>."
          icon={<Image src={JSLogo} alt="JavaScript Logo" />}
          className="my-card"
        />
        <Card
          href={`/environments/${params.environmentId}/integrations/installation/npm`}
          title="NPM"
          description="Use NPM or yarn to install the Formbricks SDK."
          icon={<Image src={NPMLogo} alt="NPM Logo" />}
          className="my-card"
        />
      </div>
    </div>
  );
}
