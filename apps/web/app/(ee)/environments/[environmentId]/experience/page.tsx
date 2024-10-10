import { Greeting } from "@/app/(ee)/environments/[environmentId]/experience/components/Greeting";
import { InsightsTable } from "@/app/(ee)/environments/[environmentId]/experience/components/InsightsTable";
import { ExperiencePageStats } from "@/app/(ee)/environments/[environmentId]/experience/components/Stats";
import { SurveyTemplates } from "@/app/(ee)/environments/[environmentId]/experience/components/SurveyTemplates";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";

export const metadata: Metadata = {
  title: "Experience",
};

const Page = async ({ params }) => {
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

  return (
    <PageContentWrapper>
      <div className="container mx-auto space-y-6 p-4">
        <Greeting userName={user.name} />
        <ExperiencePageStats />
        <InsightsTable environmentId={params.environmentId} insightsPerPage={INSIGHTS_PER_PAGE} />
        <SurveyTemplates
          environment={environment}
          product={product}
          user={user}
          prefilledFilters={[product.config.channel, product.config.industry]}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
