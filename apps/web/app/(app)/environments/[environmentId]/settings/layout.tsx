import { Metadata } from "next";
import SettingsNavbar from "./components/SettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";

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

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const isPricingDisabled =
    currentUserMembership?.role !== "owner" ? currentUserMembership?.role !== "admin" : false;
  const isAPIKeySettingDisabled = currentUserMembership?.role === "viewer";
  const isTagSettingDisabled = currentUserMembership?.role === "viewer";

  return (
    <>
      <div className="sm:flex">
        <SettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          team={team}
          product={product}
          isPricingDisabled={isPricingDisabled}
          isAPIKeySettingDisabled={isAPIKeySettingDisabled}
          isTagSettingDisabled={isTagSettingDisabled}
        />
        <div className="w-full md:ml-64">
          <div className="max-w-4xl px-6 pb-6 pt-14 md:pt-6">
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
