import { ShellFrame } from "@/modules/shell/components/shell-frame";

const OrganizationShellLayout = async ({
  params,
  children,
}: Readonly<{ params: Promise<{ organizationId: string }>; children: React.ReactNode }>) => {
  const { organizationId } = await params;

  return <ShellFrame organizationId={organizationId}>{children}</ShellFrame>;
};

export default OrganizationShellLayout;
