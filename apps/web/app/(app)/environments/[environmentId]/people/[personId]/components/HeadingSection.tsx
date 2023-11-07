import GoBackButton from "@formbricks/ui/GoBackButton";
import { DeletePersonButton } from "./DeletePersonButton";
import { getPersonIdentifier } from "@formbricks/lib/person/util";
import { getPerson } from "@formbricks/lib/person/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";

interface HeadingSectionProps {
  environmentId: string;
  personId: string;
}

export default async function HeadingSection({ environmentId, personId }: HeadingSectionProps) {
  const person = await getPerson(personId);
  const session = await getServerSession(authOptions);
  const team = await getTeamByEnvironmentId(environmentId);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  if (!person) {
    throw new Error("No such person found");
  }
  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
        <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
          <span>{getPersonIdentifier(person)}</span>
        </h1>
        {!isViewer && (
          <div className="flex items-center space-x-3">
            <DeletePersonButton
              environmentId={environmentId}
              personId={personId}
              membershipRole={currentUserMembership?.role}
            />
          </div>
        )}
      </div>
    </>
  );
}
