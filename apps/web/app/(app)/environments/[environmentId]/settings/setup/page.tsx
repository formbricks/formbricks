import EnvironmentNotice from "@/components/shared/EnvironmentNotice";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import SetupInstructions from "./SetupInstructions";

export default async function ProfileSettingsPage({ params }) {
  return (
    <>
      <div className="space-y-4">
        <SettingsTitle title="Setup Checklist" />
        <EnvironmentNotice environmentId={params.environmentId} />
        <SettingsCard
          title="Widget Status"
          description="Check if the Formbricks widget is alive and kicking.">
          <WidgetStatusIndicator environmentId={params.environmentId} type="large" />
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
