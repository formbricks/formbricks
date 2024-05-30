import { CreateFirstOrganization } from "@/app/setup/create-first-organization/components/CreateFirstOrganiztion";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/setup/auth");
  }

  return <CreateFirstOrganization />;
};

export default Page;
