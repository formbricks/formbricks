export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import Navigation from "@/app/(app)/environments/[environmentId]/Navigation";
import type { Session } from "next-auth";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getMemberships } from "@formbricks/lib/services/membership";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import NavbarLoading from "@/app/(app)/environments/[environmentId]/NavbarLoading";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
}

export default async function EnvironmentsNavbar({ environmentId, session }: EnvironmentsNavbarProps) {
  const [environment, memberships, team] = await Promise.all([
    getEnvironment(environmentId),
    getMemberships(session.user.id),
    getTeamByEnvironmentId(environmentId),
  ]);

  if (!team || !environment || !memberships) {
    return <NavbarLoading />;
  }

  return <Navigation environment={environment} team={team} memberships={memberships} session={session} />;
}
