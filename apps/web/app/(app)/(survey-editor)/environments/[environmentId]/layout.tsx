import { getEnvironment } from "@/lib/environment/service";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { DevEnvironmentBanner } from "@/modules/ui/components/dev-environment-banner";
import { EnvironmentIdBaseLayout } from "@/modules/ui/components/environmentId-base-layout";
import { redirect } from "next/navigation";

const SurveyEditorEnvironmentLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const { t, session, user, organization } = await environmentIdLayoutChecks(params.environmentId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  return (
    <EnvironmentIdBaseLayout
      environmentId={params.environmentId}
      session={session}
      user={user}
      organization={organization}>
      <div className="flex h-screen flex-col">
        <DevEnvironmentBanner environment={environment} />
        <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
      </div>
    </EnvironmentIdBaseLayout>
  );
};

export default SurveyEditorEnvironmentLayout;
