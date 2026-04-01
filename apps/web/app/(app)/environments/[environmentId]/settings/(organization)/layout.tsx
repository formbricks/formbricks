import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getWorkspaceByEnvironmentId } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const Layout = async (props: { params: Promise<{ environmentId: string }>; children: React.ReactNode }) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [organization, workspace, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getWorkspaceByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  if (!workspace) {
    throw new Error(t("common.workspace_not_found"));
  }

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  return <>{children}</>;
};

export default Layout;
