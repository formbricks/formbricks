export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EnvironmentNotice from "@/components/shared/EnvironmentNotice";
import SetupInstructions from "./SetupInstructions";
import { getEnvironment, getEnvironments } from "@formbricks/lib/services/environment";
import { getActions } from "@formbricks/lib/services/actions";
import { updateEnvironmentAction } from "@/app/(app)/environments/[environmentId]/settings/setup/actions";
import { ErrorComponent } from "@formbricks/ui";

export default async function ProfileSettingsPage({ params }) {
  const [environment, actions] = await Promise.all([
    getEnvironment(params.environmentId),
    getActions(params.environmentId),
  ]);
  const environments = await getEnvironments(environment!.productId);
  const devEnvironmentId = environments.find((e) => e.type === "development")?.id;

  if (!environment) {
    return <ErrorComponent />;
  }

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
              actions={actions}
              type="large"
              updateEnvironmentAction={updateEnvironmentAction}
            />
          </SettingsCard>

          <EnvironmentNotice environment={environment} devEnvironmentId={devEnvironmentId!} />
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
