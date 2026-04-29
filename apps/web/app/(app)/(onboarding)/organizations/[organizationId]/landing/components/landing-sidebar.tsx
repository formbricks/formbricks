"use client";

import {
  ArrowUpRightIcon,
  Building2Icon,
  ChevronRightIcon,
  Loader2,
  LogOutIcon,
  PlusIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface LandingSidebarProps {
  user: TUser;
  organization: TOrganization;
  isMultiOrgEnabled: boolean;
}

export const LandingSidebar = ({ user, organization, isMultiOrgEnabled }: LandingSidebarProps) => {
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState(false);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizationLoadError, setOrganizationLoadError] = useState<string | null>(null);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { t } = useTranslation();
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

  const loadOrganizations = useCallback(async () => {
    setIsLoadingOrganizations(true);
    setOrganizationLoadError(null);
    try {
      const result = await getOrganizationsForSwitcherAction({ organizationId: organization.id });
      if (result?.data) {
        const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
        setOrganizations(sorted);
      } else {
        setOrganizationLoadError(
          getFormattedErrorMessage(result) || t("common.failed_to_load_organizations")
        );
      }
    } catch {
      setOrganizationLoadError(t("common.failed_to_load_organizations"));
    } finally {
      setIsLoadingOrganizations(false);
    }
  }, [organization.id, t]);

  useEffect(() => {
    if (
      isOrgDropdownOpen &&
      organizations.length === 0 &&
      !isLoadingOrganizations &&
      !organizationLoadError
    ) {
      loadOrganizations();
    }
  }, [
    isOrgDropdownOpen,
    organizations.length,
    isLoadingOrganizations,
    organizationLoadError,
    loadOrganizations,
  ]);

  const handleOrganizationChange = (orgId: string) => {
    startTransition(() => {
      setIsOrgDropdownOpen(false);
      router.push(`/organizations/${orgId}/`);
    });
  };

  const dropdownNavigation = [
    {
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
  ];

  const switcherTriggerClasses =
    "w-full border-t px-3 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-inset";
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
                <Building2Icon className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <div className="grow overflow-hidden">
                <p className="truncate text-sm font-bold text-slate-700">{organization.name}</p>
                <p className="text-sm text-slate-500">{t("common.organization")}</p>
              </div>
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-600" strokeWidth={1.5} />}
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
            <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
              <Building2Icon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
              {t("common.change_organization")}
            </div>
            {isLoadingOrganizations && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoadingOrganizations && organizationLoadError && (
              <div className="px-2 py-4">
                <p className="mb-2 text-sm text-red-600">{organizationLoadError}</p>
                <button
                  onClick={() => {
                    setOrganizationLoadError(null);
                    setOrganizations([]);
                  }}
                  className="text-xs text-slate-600 underline hover:text-slate-800">
                  {t("common.try_again")}
                </button>
              </div>
            )}
            {!isLoadingOrganizations && !organizationLoadError && (
              <>
                <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                  {organizations.map((org) => (
                    <DropdownMenuCheckboxItem
                      key={org.id}
                      checked={org.id === organization.id}
                      onClick={() => handleOrganizationChange(org.id)}
                      className="cursor-pointer">
                      {org.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                {isMultiOrgEnabled && (
                  <DropdownMenuCheckboxItem
                    onClick={() => setOpenCreateOrganizationModal(true)}
                    className="w-full cursor-pointer justify-between">
                    <span>{t("common.create_new_organization")}</span>
                    <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
                  </DropdownMenuCheckboxItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            id="userDropdownTrigger"
            className={cn(switcherTriggerClasses, "rounded-br-xl")}>
            <button type="button" className="flex w-full items-center gap-3">
              <span className={switcherIconClasses}>
                <ProfileAvatar userId={user.id} />
              </span>
              <div className="grow overflow-hidden">
                <p
                  title={user?.email}
                  className="ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700">
                  {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                </p>
                <p className="text-sm text-slate-500">{t("common.account")}</p>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
            {dropdownNavigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.target}
                rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
                className="flex w-full items-center">
                <DropdownMenuItem>
                  <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {link.label}
                </DropdownMenuItem>
              </Link>
            ))}
            <DropdownMenuItem
              onClick={async () => {
                await signOutWithAudit({
                  reason: "user_initiated",
                  redirectUrl: "/auth/login",
                  organizationId: organization.id,
                  redirect: true,
                  callbackUrl: "/auth/login",
                });
              }}
              icon={<LogOutIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />}>
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateOrganizationModal open={openCreateOrganizationModal} setOpen={setOpenCreateOrganizationModal} />
    </aside>
  );
};
