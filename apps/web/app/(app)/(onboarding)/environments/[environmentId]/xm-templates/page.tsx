import { XMTemplateList } from "@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/components/XMTemplateList";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProjectByEnvironmentId, getUserProjects } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";

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
    throw new Error(t("common.session_not_found"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(environment.id);

  const project = await getProjectByEnvironmentId(environment.id);
  if (!project) {
    throw new Error(t("common.project_not_found"));
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
