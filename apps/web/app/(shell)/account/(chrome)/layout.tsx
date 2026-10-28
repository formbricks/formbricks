import { redirect } from "next/navigation";
import { ShellFrame } from "@/modules/shell/components/shell-frame";
import { ShellIntegrations } from "@/modules/shell/components/shell-integrations";
import { getActiveOrganizationId } from "@/modules/shell/lib/active-organization";

/** Account pages belong to the user, not an organization, but the shell chrome needs one to link to. */
const AccountShellLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return redirect("/account/no-organization");
  }

  return (
    <>
      <ShellIntegrations />
      <ShellFrame organizationId={organizationId}>{children}</ShellFrame>
    </>
  );
};

export default AccountShellLayout;
