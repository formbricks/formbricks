import { getTranslate } from "@/lingodotdev/server";
import { getShellNavItems } from "../lib/nav-items";
import { getShellData } from "../lib/shell-data";
import { MobileNav } from "./mobile-nav";
import { OrgSwitcher } from "./org-switcher";
import { ShellNavLinks } from "./shell-nav-links";
import { SignOutButton } from "./sign-out-button";

/**
 * The account shell: a sidebar on wide screens, a top bar with a sheet on narrow ones. Pages render
 * inside `<ShellPage>`, which supplies the content column.
 */
export const ShellFrame = async ({
  organizationId,
  children,
}: Readonly<{ organizationId: string; children: React.ReactNode }>) => {
  const [t, shell] = await Promise.all([getTranslate(), getShellData(organizationId)]);

  const items = getShellNavItems({
    organizationId,
    isBilling: shell.isBilling,
    labels: {
      connect: t("shell.nav.connect"),
      connections: t("shell.nav.connections"),
      organization: t("common.organization"),
      account: t("common.account"),
    },
  });
  const labels = {
    openMenu: t("shell.nav.open_menu"),
    navigation: t("shell.nav.sections"),
    switchOrganization: t("shell.nav.switch_organization"),
  };

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-white md:flex-row">
      <aside
        className="hidden w-62 flex-none flex-col gap-4 border-r border-slate-200 bg-slate-50 px-3 py-4 md:flex"
        aria-label={t("shell.nav.primary")}>
        <OrgSwitcher
          organization={{ id: shell.organization.id, name: shell.organization.name }}
          organizations={shell.organizations}
          switchLabel={labels.switchOrganization}
        />
        <ShellNavLinks items={items} organizationId={organizationId} ariaLabel={labels.navigation} />
        <div className="mt-auto flex flex-col border-t border-slate-200 pt-2.5 text-sm">
          <div className="flex flex-col px-2.5">
            <span className="truncate font-medium text-slate-800">{shell.user.name}</span>
            <span className="truncate text-xs text-slate-500">{shell.user.email}</span>
          </div>
          <SignOutButton user={shell.user} organizationId={organizationId} label={t("common.logout")} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          items={items}
          organization={{ id: shell.organization.id, name: shell.organization.name }}
          organizations={shell.organizations}
          user={shell.user}
          labels={labels}
        />
        <main className="flex-1 px-4 pt-6 pb-12 md:px-10 md:pt-8 md:pb-16">{children}</main>
      </div>
    </div>
  );
};
