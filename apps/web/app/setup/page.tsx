import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getHasNoOrganizations, getIsFreshInstance } from "@/lib/instance/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

const Page = async () => {
  const [session, isFreshInstance, hasNoOrganizations] = await Promise.all([
    getServerSession(authOptions),
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
