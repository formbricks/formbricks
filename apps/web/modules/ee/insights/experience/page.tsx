import { DOCUMENTS_PER_PAGE, INSIGHTS_PER_PAGE } from "@/lib/constants";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Dashboard } from "@/modules/ee/insights/experience/components/dashboard";
import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

export const ExperiencePage = async (props) => {
  const params = await props.params;

  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  const [environment, project, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!project) {
    throw new Error("Project not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    notFound();
  }

  const isAIEnabled = await getIsAIEnabled({
    isAIEnabled: organization.isAIEnabled,
    billing: organization.billing,
  });

  if (!isAIEnabled) {
    notFound();
  }
  const locale = await findMatchingLocale();

  return (
    <PageContentWrapper>
      <Dashboard
        environment={environment}
        insightsPerPage={INSIGHTS_PER_PAGE}
        project={project}
        user={user}
        documentsPerPage={DOCUMENTS_PER_PAGE}
        locale={locale}
      />
    </PageContentWrapper>
  );
};
