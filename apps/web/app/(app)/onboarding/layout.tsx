import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { ToasterClient } from "@formbricks/ui/ToasterClient";

const EnvironmentLayout = async ({ children }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  return (
    <div className="h-full w-full bg-slate-50">
      <PosthogIdentify session={session} />
      <ToasterClient />
      {children}
    </div>
  );
};

export default EnvironmentLayout;
