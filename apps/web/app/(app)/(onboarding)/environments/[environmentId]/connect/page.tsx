import { ConnectWithFormbricks } from "@/app/(app)/(onboarding)/environments/[environmentId]/connect/components/ConnectWithFormbricks";
import { XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/components/Button";
import { Header } from "@formbricks/ui/components/Header";

interface ConnectPageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: ConnectPageProps) => {
  const t = await getTranslations();
  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const channel = product.config.channel || null;

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-10">
      <Header title={t("environments.connect.headline")} subtitle={t("environments.connect.subtitle")} />
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500"></p>
      </div>
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={WEBAPP_URL}
        widgetSetupCompleted={environment.appSetupCompleted}
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
