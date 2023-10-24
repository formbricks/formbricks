import EditTagsWrapper from "./components/EditTagsWrapper";
import SettingsTitle from "../components/SettingsTitle";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/tagOnResponse/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export default async function MembersSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const tags = await getTagsByEnvironmentId(params.environmentId);
  const environmentTagsCount = await getTagsOnResponsesCount(params.environmentId);
  const team = await getTeamByEnvironmentId(params.environmentId);
  const session = await getServerSession(authOptions);

  if (!environment) {
    throw new Error("Environment not found");
  }
  if (!team) {
    throw new Error("Team not found");
  }

  if (!session) {
    throw new Error("Unauthenticated");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const isTagSettingDisabled = currentUserMembership?.role === "viewer";

  return !isTagSettingDisabled ? (
    <div>
      <SettingsTitle title="Tags" />
      <EditTagsWrapper
        environment={environment}
        environmentTags={tags}
        environmentTagsCount={environmentTagsCount}
      />
    </div>
  ) : (
    <ErrorComponent />
  );
}
