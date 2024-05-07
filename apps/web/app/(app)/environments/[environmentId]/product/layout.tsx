import { ProductConfigTabs } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigTabs";
import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "Config",
};

export default async function ConfigLayout({ children, params }) {
  const [team, product, session] = await Promise.all([
    getTeamByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!team) {
    throw new Error("Team not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!session) {
    throw new Error("Unauthenticated");
  }

  return (
    <>
      <div className="flex">
        <ProductConfigTabs environmentId={params.environmentId} />
        <div className="w-full">
          <InnerContentWrapper pageTitle="Configuration">{children}</InnerContentWrapper>
        </div>
      </div>
    </>
  );
}
