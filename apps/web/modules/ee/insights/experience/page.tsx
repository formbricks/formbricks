import { getIsAIEnabled } from "@/app/lib/utils";
import { Dashboard } from "@/modules/ee/insights/experience/components/dashboard";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { DOCUMENTS_PER_PAGE, INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";

export const ExperiencePage = async ({ params }) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  const [environment, product, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAIEnabled = await getIsAIEnabled(organization);

  if (!isAIEnabled) {
    notFound();
  }

  return (
    <PageContentWrapper>
      <Dashboard
        environment={environment}
        insightsPerPage={INSIGHTS_PER_PAGE}
        product={product}
        user={user}
        documentsPerPage={DOCUMENTS_PER_PAGE}
      />
    </PageContentWrapper>
  );
};
