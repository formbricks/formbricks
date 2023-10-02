import EnvironmentsNavbar from "@/app/(app)/environments/[environmentId]/EnvironmentsNavbar";
import ToasterClient from "@/components/ToasterClient";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import FormbricksClient from "../../FormbricksClient";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export default async function EnvironmentLayout({ children, params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
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
