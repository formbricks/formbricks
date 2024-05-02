import ProductConfigTabs from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigTabs";
import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { ContentWrapper } from "@formbricks/ui/ContentWrapper";

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

  const isMultiLanguageAllowed = getMultiLanguagePermission(team);

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);

  return (
    <ContentWrapper pageTitle="Configuration">
      <ProductConfigTabs activeId="api-keys" environmentId={params.environmentId} />
      {children}
    </ContentWrapper>
  );
}
