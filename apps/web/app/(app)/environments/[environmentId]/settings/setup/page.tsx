export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EnvironmentNotice from "./EnvironmentNotice";
import SetupInstructions from "./SetupInstructions";
import { getEnvironment, getEnvironments } from "@formbricks/lib/services/environment";
import { getEvents } from "@formbricks/lib/services/events";
import { updateEnvironmentAction } from "@/app/(app)/environments/[environmentId]/settings/setup/actions";

export default async function ProfileSettingsPage({ params }) {
  const [environment, events] = await Promise.all([
    getEnvironment(params.environmentId),
    getEvents(params.environmentId),
  ]);
  const environments = await getEnvironments(environment!.productId);

  return (
    <>
      {environment && (
        <div className="space-y-4">
          <SettingsTitle title="Setup Checklist" />
          <SettingsCard
            title="Widget Status"
            description="Check if the Formbricks widget is alive and kicking.">
            <WidgetStatusIndicator
              environment={environment}
              events={events}
              type="large"
              updateEnvironmentAction={updateEnvironmentAction}
            />
          </SettingsCard>

          <EnvironmentNotice environment={environment} environments={environments} />
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
