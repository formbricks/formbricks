import { ShellFrame } from "@/modules/shell/components/shell-frame";
import { ShellIntegrations } from "@/modules/shell/components/shell-integrations";

const OrganizationShellLayout = async ({
  params,
  children,
}: Readonly<{ params: Promise<{ organizationId: string }>; children: React.ReactNode }>) => {
  const { organizationId } = await params;

  return (
    <>
      <ShellIntegrations />
      <ShellFrame organizationId={organizationId}>{children}</ShellFrame>
    </>
  );
};

export default OrganizationShellLayout;
