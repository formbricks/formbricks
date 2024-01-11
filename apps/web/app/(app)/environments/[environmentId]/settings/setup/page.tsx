import WidgetStatusIndicator from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";

import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import EnvironmentNotice from "@formbricks/ui/EnvironmentNotice";

import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import EnvironmentIdField from "./components/EnvironmentIdField";
import SetupInstructions from "./components/SetupInstructions";

export default async function ProfileSettingsPage({ params }) {
  return (
    <>
      <div className="space-y-4">
        <SettingsTitle title="Setup Checklist" />
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/settings/setup" />
        <SettingsCard
          title="Widget Status"
          description="Check if the Formbricks widget is alive and kicking.">
          <WidgetStatusIndicator environmentId={params.environmentId} type="large" />
        </SettingsCard>
        <SettingsCard
          title="Your EnvironmentId"
          description="This Id uniquely identifies this Formbricks environment.">
          <EnvironmentIdField environmentId={params.environmentId} />
        </SettingsCard>
        <SettingsCard
          title="How to setup"
          description="Follow these steps to setup the Formbricks widget within your app"
          noPadding>
          <SetupInstructions
            environmentId={params.environmentId}
            webAppUrl={WEBAPP_URL}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        </SettingsCard>
      </div>
    </>
  );
}
