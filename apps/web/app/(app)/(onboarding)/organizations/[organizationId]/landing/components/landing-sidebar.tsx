"use client";

import { Building2Icon, ChevronRightIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { SwitcherDropdownBody } from "@/modules/settings/components/switcher-dropdown-body";
import { UserDropdown } from "@/modules/settings/components/user-dropdown";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface LandingSidebarProps {
  user: TUser;
  organization: TOrganization;
  publicDomain: string;
}

export const LandingSidebar = ({ user, organization, publicDomain }: Readonly<LandingSidebarProps>) => {
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { t } = useTranslation();

  const organizationSwitcher = useSwitcherData(
    () => getOrganizationsForSwitcherAction({ organizationId: organization.id }),
    t("common.failed_to_load_organizations")
  );
  const { load: loadOrganizations } = organizationSwitcher;

  useEffect(() => {
    // The hook guards against duplicate/looping loads internally.
    if (isOrgDropdownOpen) {
      void loadOrganizations();
    }
  }, [isOrgDropdownOpen, loadOrganizations]);

  const handleOrganizationChange = (orgId: string) => {
    startTransition(() => {
      setIsOrgDropdownOpen(false);
      router.push(`/organizations/${orgId}/`);
    });
  };

  const switcherTriggerClasses =
    "w-full border-t px-3 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-inset";
  const switcherIconClasses =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600";

  return (
    <aside
      className={cn(
        "z-40 flex w-sidebar-collapsed flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100"
      )}>
      <Image src={FBLogo} width={160} height={30} alt={t("workspace.formbricks_logo")} />

      <div className="flex flex-col">
        {/* Organization Switcher */}
        <DropdownMenu onOpenChange={setIsOrgDropdownOpen}>
          <DropdownMenuTrigger asChild className={switcherTriggerClasses}>
            <button type="button" className="flex w-full items-center gap-3">
              <span className={switcherIconClasses}>
                <Building2Icon className="size-4" strokeWidth={1.5} />
              </span>
              <div className="grow overflow-hidden">
                <p className="truncate text-sm font-bold text-slate-700">{organization.name}</p>
                <p className="text-sm text-slate-500">{t("common.organization")}</p>
              </div>
              {isPending && <Loader2 className="size-4 animate-spin text-slate-600" strokeWidth={1.5} />}
              <ChevronRightIcon className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
            <SwitcherDropdownBody
              type="organization"
              isLoading={organizationSwitcher.isLoading}
              error={organizationSwitcher.error}
              onRetry={organizationSwitcher.retry}
              items={organizationSwitcher.items}
              selectedId={organization.id}
              onSelect={handleOrganizationChange}
              showSettings={false}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Dropdown */}
        <UserDropdown
          user={user}
          organizationId={organization.id}
          publicDomain={publicDomain}
          className="rounded-br-xl"
        />
      </div>
    </aside>
  );
};
