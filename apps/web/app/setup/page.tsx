import { redirect } from "next/navigation";
import { getHasNoOrganizations, getIsFreshInstance } from "@/lib/instance/service";
import { getSession } from "@/modules/auth/lib/session";

const Page = async () => {
  const [session, isFreshInstance, hasNoOrganizations] = await Promise.all([
    getSession(),
    getIsFreshInstance(),
    getHasNoOrganizations(),
  ]);

  if (isFreshInstance) {
    return redirect("/setup/intro");
  }

  if (hasNoOrganizations) {
    if (session) {
      return redirect("/setup/organization/create");
    }

    return redirect("/auth/login?callbackUrl=%2Fsetup%2Forganization%2Fcreate");
  }

  return redirect("/");
};

export default Page;
