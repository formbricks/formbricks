import { getServerSession } from "next-auth";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const Layout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [organization, project, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  return <>{children}</>;
};

export default Layout;
