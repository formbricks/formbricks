import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const AccountSettingsLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [workspace, session] = await Promise.all([
    getWorkspace(params.workspaceId),
    getServerSession(authOptions),
  ]);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const organization = await getOrganization(workspace.organizationId);

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  return <>{children}</>;
};

export default AccountSettingsLayout;
