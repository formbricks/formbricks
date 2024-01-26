import EnvironmentsNavbar from "@/app/(app)/environments/[environmentId]/components/EnvironmentsNavbar";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import ToasterClient from "@formbricks/ui/ToasterClient";

import FormbricksClient from "../../components/FormbricksClient";

export default async function EnvironmentLayout({ children, params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }
  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  return (
    <>
      <ResponseFilterProvider>
        <FormbricksClient session={session} />
        <ToasterClient />
        <EnvironmentsNavbar
          environmentId={params.environmentId}
          session={session}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        />
        <main className="h-full flex-1 overflow-y-auto bg-slate-50">
          {children}
          <main />
        </main>
      </ResponseFilterProvider>
    </>
  );
}
