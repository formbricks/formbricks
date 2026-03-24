import { getServerSession } from "next-auth";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const AccountSettingsLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [organization, project, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  if (!project) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  if (!session) {
    throw new ResourceNotFoundError(t("common.session"), null);
  }

  return <>{children}</>;
};

export default AccountSettingsLayout;
