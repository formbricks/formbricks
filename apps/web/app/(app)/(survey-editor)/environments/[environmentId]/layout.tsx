import { redirect } from "next/navigation";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment } from "@/lib/environment/service";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";

const SurveyEditorEnvironmentLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const { t, session, user } = await environmentIdLayoutChecks(params.environmentId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new ResourceNotFoundError(t("common.environment"), params.environmentId);
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
    </div>
  );
};

export default SurveyEditorEnvironmentLayout;
