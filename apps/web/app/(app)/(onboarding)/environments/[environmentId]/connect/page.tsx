import { ConnectWithFormbricks } from "@/app/(app)/(onboarding)/environments/[environmentId]/connect/components/ConnectWithFormbricks";
import { WEBAPP_URL } from "@/lib/constants";
import { getEnvironment } from "@/lib/environment/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { XIcon } from "lucide-react";
import Link from "next/link";

interface ConnectPageProps {
  params: Promise<{
    environmentId: string;
  }>;
}

const Page = async (props: ConnectPageProps) => {
  const params = await props.params;
  const t = await getTranslate();
  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const project = await getProjectByEnvironmentId(environment.id);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const channel = project.config.channel || null;

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
        className="absolute top-5 right-5 !mt-0 text-slate-500 hover:text-slate-700"
        variant="ghost"
        asChild>
        <Link href={`/environments/${environment.id}`}>
          <XIcon className="h-7 w-7" strokeWidth={1.5} />
        </Link>
      </Button>
    </div>
  );
};

export default Page;
