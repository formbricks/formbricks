import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getIsFreshInstance, gethasNoOrganizations } from "@/lib/instance/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const FreshInstanceLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (!isFreshInstance) {
    const hasNoOrganizations = await gethasNoOrganizations();

    if (hasNoOrganizations) {
      if (session) {
        return redirect("/setup/organization/create");
      }

      return redirect("/auth/login?callbackUrl=%2Fsetup%2Forganization%2Fcreate");
    }

    return notFound();
  }

  if (session) {
    return notFound();
  }

  return <>{children}</>;
};
