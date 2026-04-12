import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { SettingsSidebar } from "@/modules/settings/components/settings-sidebar";

const SettingsLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  const { project, organization, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

  return (
    <div className="flex h-screen min-h-screen overflow-hidden">
      <SettingsSidebar
        environmentId={params.environmentId}
        projectName={project.name}
        organizationName={organization.name}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        membershipRole={currentUserMembership?.role}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50">{children}</div>
    </div>
  );
};

export default SettingsLayout;
