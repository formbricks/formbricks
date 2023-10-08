import { Metadata } from "next";
import SettingsNavbar from "./SettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsLayout({ children, params }) {
  const [team, product] = await Promise.all([
    getTeamByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);
  if (!team) {
    throw new Error("Team not found");
  }
  if (!product) {
    throw new Error("Product not found");
  }
  return (
    <>
      <div className="sm:flex">
        <SettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          team={team}
          product={product}
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
