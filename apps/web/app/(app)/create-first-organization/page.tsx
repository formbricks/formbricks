import { CreateFirstOrganization } from "@/app/(app)/create-first-organization/components/CreateFirstOrganization";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return <CreateFirstOrganization />;
};

export default Page;
