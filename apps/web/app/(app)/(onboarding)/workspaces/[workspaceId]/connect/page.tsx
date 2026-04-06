import { XIcon } from "lucide-react";
import Link from "next/link";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ConnectWithFormbricks } from "@/app/(app)/(onboarding)/workspaces/[workspaceId]/connect/components/ConnectWithFormbricks";
import { getEnvironments } from "@/lib/environment/service";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";

interface ConnectPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

const Page = async (props: ConnectPageProps) => {
  const params = await props.params;
  const t = await getTranslate();

  const workspace = await getWorkspace(params.workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), params.workspaceId);
  }

  const environments = await getEnvironments(params.workspaceId);
  const environment = environments[0];
  if (!environment) {
    throw new ResourceNotFoundError(t("common.environment"), null);
  }

  const channel = workspace.config.channel || null;

  const publicDomain = getPublicDomain();

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-10">
      <Header title={t("environments.connect.headline")} subtitle={t("environments.connect.subtitle")} />
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500"></p>
      </div>
      <ConnectWithFormbricks
        environment={environment}
        workspaceId={params.workspaceId}
        publicDomain={publicDomain}
        appSetupCompleted={environment.appSetupCompleted}
        channel={channel}
      />
      <Button
        className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
        variant="ghost"
        asChild>
        <Link href={`/workspaces/${params.workspaceId}`}>
          <XIcon className="h-7 w-7" strokeWidth={1.5} />
        </Link>
      </Button>
    </div>
  );
};

export default Page;
