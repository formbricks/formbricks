import { CreateFirstTeam } from "@/app/(app)/create-first-team/components/CreateFirstTeam";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return <CreateFirstTeam />;
};

export default Page;
