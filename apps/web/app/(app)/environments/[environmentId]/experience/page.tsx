import { InsightView } from "@/app/(app)/environments/[environmentId]/components/InsightView";
import { Metadata } from "next";
import { getInsights } from "@formbricks/lib/insight/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

export const metadata: Metadata = {
  title: "Experience",
};

const Page = async ({ params }) => {
  const [product, organization, insights] = await Promise.all([
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getInsights(params.environmentId),
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
      <InsightView insights={insights} />
    </PageContentWrapper>
  );
};

export default Page;
