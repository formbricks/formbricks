import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";

export const metadata: Metadata = {
  title: "Configuration",
};

export const ProjectSettingsLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();

  const [organization, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new Error("Project not found");
  }

  return children;
};
