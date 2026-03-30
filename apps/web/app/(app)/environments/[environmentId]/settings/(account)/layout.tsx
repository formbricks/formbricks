import { getServerSession } from "next-auth";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getWorkspaceByEnvironmentId } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const AccountSettingsLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [organization, workspace, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getWorkspaceByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!workspace) {
    throw new Error(t("common.workspace_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  return <>{children}</>;
};

export default AccountSettingsLayout;
