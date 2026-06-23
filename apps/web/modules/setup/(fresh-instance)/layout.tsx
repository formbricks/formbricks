import { notFound, redirect } from "next/navigation";
import { getHasNoOrganizations, getIsFreshInstance } from "@/lib/instance/service";
import { getSession } from "@/modules/auth/lib/session";

export const FreshInstanceLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const session = await getSession();
  const isFreshInstance = await getIsFreshInstance();

  if (!isFreshInstance) {
    const hasNoOrganizations = await getHasNoOrganizations();

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
