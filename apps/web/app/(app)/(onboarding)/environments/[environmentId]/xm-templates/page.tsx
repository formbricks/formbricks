import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { XMTemplateList } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/components/XMTemplateList";
import { getEnvironment } from "@/lib/environment/service";
import { getProjectByEnvironmentId, getUserProjects } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";

interface XMTemplatePageProps {
  params: Promise<{
    environmentId: string;
  }>;
}

const Page = async (props: XMTemplatePageProps) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const environment = await getEnvironment(params.environmentId);
  const t = await getTranslate();
  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }
  if (!environment) {
    throw new ResourceNotFoundError(t("common.environment"), params.environmentId);
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(environment.id);

  const project = await getProjectByEnvironmentId(environment.id);
  if (!project) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const projects = await getUserProjects(session.user.id, organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title={t("environments.xm-templates.headline")} />
      <XMTemplateList project={project} user={user} environmentId={environment.id} />
      {projects.length >= 2 && (
        <Button
          className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
          variant="ghost"
          asChild>
          <Link href={`/environments/${environment.id}/surveys`}>
            <XIcon className="h-7 w-7" strokeWidth={1.5} />
          </Link>
        </Button>
      )}
    </div>
  );
};

export default Page;
