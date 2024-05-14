import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const metadata: Metadata = {
  title: "Config",
};

const ConfigLayout = async ({ children, params }) => {
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

  return children;
};

export default ConfigLayout;
