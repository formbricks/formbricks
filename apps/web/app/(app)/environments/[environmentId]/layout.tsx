import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { EnvironmentIdBaseLayout } from "@/modules/ui/components/environmentId-base-layout";
import { redirect } from "next/navigation";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const { t, session, user, organization } = await environmentIdLayoutChecks(params.environmentId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const [project, environment] = await Promise.all([
    getProjectByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);

  if (!membership) {
    throw new Error(t("common.membership_not_found"));
  }

  return (
    <EnvironmentIdBaseLayout
      environmentId={params.environmentId}
      session={session}
      user={user}
      organization={organization}>
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      <EnvironmentContextWrapper environment={environment} project={project}>
        <EnvironmentLayout environmentId={params.environmentId} session={session}>
          {children}
        </EnvironmentLayout>
      </EnvironmentContextWrapper>
    </EnvironmentIdBaseLayout>
  );
};

export default EnvLayout;
