import { TeamSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(team)/components/TeamSettingsNavbar";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export default async function Layout({ children, params }) {
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

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);

  return (
    <>
      <TeamSettingsNavbar
        environmentId={params.environmentId}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        membershipRole={currentUserMembership?.role ?? "viewer"}
      />
      {children}
    </>
  );
}
