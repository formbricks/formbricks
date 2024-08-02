import { ConnectWithFormbricks } from "@/app/(app)/(onboarding)/environments/[environmentId]/connect/components/ConnectWithFormbricks";
import { getCustomHeadline } from "@/app/(app)/(onboarding)/lib/utils";
import { XIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface ConnectPageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: ConnectPageProps) => {
  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  const channel = product.config.channel;
  const industry = product.config.industry;

  if (!channel || !industry) {
    return notFound();
  }
  const customHeadline = getCustomHeadline(channel, industry);

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-10">
      <Header
        title={`Let's connect your ${customHeadline} with Formbricks`}
        subtitle="It takes less than 4 minutes, pinky promise!"
      />
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500"></p>
      </div>
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={WEBAPP_URL}
        widgetSetupCompleted={
          channel === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted
        }
        channel={channel}
      />
      <Button
        className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
        variant="minimal"
        href={`/environments/${environment.id}/`}>
        <XIcon className="h-7 w-7" strokeWidth={1.5} />
      </Button>
    </div>
  );
};

export default Page;
