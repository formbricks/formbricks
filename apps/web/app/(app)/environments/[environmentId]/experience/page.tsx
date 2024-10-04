import { InsightsTable } from "@/app/(app)/environments/[environmentId]/experience/components/InsightsTable";
import { Metadata } from "next";
import { INSIGHTS_PER_PAGE } from "@formbricks/lib/constants";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

export const metadata: Metadata = {
  title: "Experience",
};

const Page = async ({ params }) => {
  const [product, organization] = await Promise.all([
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Experience" />
      <InsightsTable environmentId={params.environmentId} insightsPerPage={INSIGHTS_PER_PAGE} />
    </PageContentWrapper>
  );
};

export default Page;
