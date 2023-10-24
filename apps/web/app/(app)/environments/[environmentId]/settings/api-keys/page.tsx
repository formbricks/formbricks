export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import ApiKeyList from "./components/ApiKeyList";
import EnvironmentNotice from "@formbricks/ui/EnvironmentNotice";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export default async function ProfileSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
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
  const isAPIKeySettingDisabled = currentUserMembership?.role === "viewer";

  return !isAPIKeySettingDisabled ? (
    <div>
      <SettingsTitle title="API Keys" />
      <EnvironmentNotice environmentId={environment.id} />
      {environment.type === "development" ? (
        <SettingsCard
          title="Development Env Keys"
          description="Add and remove API keys for your Development environment.">
          <ApiKeyList environmentId={params.environmentId} environmentType="development" />
        </SettingsCard>
      ) : (
        <SettingsCard
          title="Production Env Keys"
          description="Add and remove API keys for your Production environment.">
          <ApiKeyList environmentId={params.environmentId} environmentType="production" />
        </SettingsCard>
      )}
    </div>
  ) : (
    <ErrorComponent />
  );
}
