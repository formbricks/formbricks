export const revalidate = REVALIDATION_INTERVAL;

import { updateEnvironmentAction } from "@/app/(app)/environments/[environmentId]/settings/setup/actions";
import EnvironmentNotice from "@/components/shared/EnvironmentNotice";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getActionsByEnvironmentId } from "@formbricks/lib/services/actions";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { ErrorComponent } from "@formbricks/ui";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import SetupInstructions from "./SetupInstructions";

export default async function ProfileSettingsPage({ params }) {
  const [environment, actions] = await Promise.all([
    await getEnvironment(params.environmentId),
    getActionsByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    return <ErrorComponent />;
  }

  return (
    <>
      {environment && (
        <div className="space-y-4">
          <SettingsTitle title="Setup Checklist" />
          <EnvironmentNotice environment={environment} />
          <SettingsCard
            title="Widget Status"
            description="Check if the Formbricks widget is alive and kicking.">
            <WidgetStatusIndicator
              environment={environment}
              actions={actions}
              type="large"
              updateEnvironmentAction={updateEnvironmentAction}
            />
          </SettingsCard>

          <SettingsCard
            title="How to setup"
            description="Follow these steps to setup the Formbricks widget within your app"
            noPadding>
            <SetupInstructions environmentId={params.environmentId} />
          </SettingsCard>
        </div>
      )}
    </>
  );
}
