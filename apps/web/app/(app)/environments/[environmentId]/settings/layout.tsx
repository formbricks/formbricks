import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

import SettingsNavbar from "./components/SettingsNavbar";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsLayout({ children, params }) {
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
    <div className="flex">
      <SettingsNavbar
        environmentId={params.environmentId}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        team={team}
        product={product}
        membershipRole={currentUserMembership?.role}
        isMultiLanguageAllowed={isMultiLanguageAllowed}
      />
      <InnerContentWrapper pageTitle="Settings">{children}</InnerContentWrapper>
    </div>
  );
}
