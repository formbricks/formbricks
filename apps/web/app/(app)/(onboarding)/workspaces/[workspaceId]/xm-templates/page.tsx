import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { XMTemplateList } from "@/app/(app)/(onboarding)/workspaces/[workspaceId]/xm-templates/components/XMTemplateList";
import { getUser } from "@/lib/user/service";
import { getUserWorkspaces, getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";

interface XMTemplatePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

const Page = async (props: XMTemplatePageProps) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const t = await getTranslate();

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const workspace = await getWorkspace(params.workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), params.workspaceId);
  }

  const workspaces = await getUserWorkspaces(session.user.id, workspace.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title={t("workspace.xm-templates.headline")} />
      <XMTemplateList workspace={workspace} user={user} workspaceId={params.workspaceId} />
      {workspaces.length >= 2 && (
        <Button
          className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
          variant="ghost"
          asChild>
          <Link href={`/workspaces/${params.workspaceId}/surveys`}>
            <XIcon className="h-7 w-7" strokeWidth={1.5} />
          </Link>
        </Button>
      )}
    </div>
  );
};

export default Page;
