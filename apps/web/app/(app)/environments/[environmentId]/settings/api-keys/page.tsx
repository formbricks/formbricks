export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import ApiKeyList from "./ApiKeyList";
import EnvironmentNotice from "@/app/(app)/environments/[environmentId]/settings/setup/EnvironmentNotice";

export default async function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="API Keys" />
      <SettingsCard
        title="Development Env Keys"
        description="Add and remove API keys for your Development environment.">
        <ApiKeyList environmentId={params.environmentId} environmentType="development" />
      </SettingsCard>
      <EnvironmentNotice environmentId={params.environmentId} pageType="apiSettings"/>
      <SettingsCard
        title="Production Env Keys"
        description="Add and remove API keys for your Production environment.">
        <ApiKeyList environmentId={params.environmentId} environmentType="production" />
      </SettingsCard>
    </div>
  );
}
