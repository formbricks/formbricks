import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { SidebarLayout } from "@formbricks/ui/SidebarLayout";

export default async function AccountSettingsLayout({ children, params }) {
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
    <SidebarLayout sidebar={<AccountSettingsNavbar environmentId={params.environmentId} />}>
      {children}
    </SidebarLayout>
  );
}
