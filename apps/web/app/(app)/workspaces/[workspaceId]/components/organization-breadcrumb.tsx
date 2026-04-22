"use client";

import * as Sentry from "@sentry/nextjs";
import {
  Building2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useOrganization, useWorkspace } from "../context/workspace-context";

interface OrganizationBreadcrumbProps {
  currentOrganizationId: string;
  currentOrganizationName?: string; // Optional: pass directly if context not available
  isMultiOrgEnabled: boolean;
  currentWorkspaceId?: string;
  isFormbricksCloud: boolean;
  isMember: boolean;
  isOwnerOrManager: boolean;
  isMembershipPending: boolean;
}

const isActiveOrganizationSetting = (pathname: string, settingId: string): boolean => {
  // Match /settings/{settingId} or /settings/{settingId}/... but exclude account settings
  // Exclude paths with /(account)/
  if (pathname.includes("/(account)/")) {
    return false;
  }
  // Check if path matches /settings/{settingId} (with optional trailing path)
  const pattern = new RegExp(`/settings/${settingId}(?:/|$)`);
  return pattern.test(pathname);
};

export const OrganizationBreadcrumb = ({
  currentOrganizationId,
  currentOrganizationName,
  isMultiOrgEnabled,
  currentWorkspaceId,
  isFormbricksCloud,
  isMember,
  isOwnerOrManager,
  isMembershipPending,
}: OrganizationBreadcrumbProps) => {
  const { t } = useTranslation();
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Get current organization name from context OR prop
  // Context is preferred, but prop is fallback for pages without EnvironmentContextWrapper
  const { organization: currentOrganization } = useOrganization();
  const { workspace } = useWorkspace();
  const organizationName = currentOrganization?.name || currentOrganizationName || "";

  // Lazy-load organizations when dropdown opens
  useEffect(() => {
    // Only fetch when dropdown opened for first time (and no error state)
    if (isOrganizationDropdownOpen && organizations.length === 0 && !isLoadingOrganizations && !loadError) {
      setIsLoadingOrganizations(true);
      setLoadError(null); // Clear any previous errors
      getOrganizationsForSwitcherAction({ organizationId: currentOrganizationId }).then((result) => {
        if (result?.data) {
          // Sort organizations by name
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setOrganizations(sorted);
        } else {
          // Handle server errors or validation errors
          const errorMessage = getFormattedErrorMessage(result);
          const error = new Error(errorMessage);
          logger.error(error, "Failed to load organizations");
          Sentry.captureException(error);
          setLoadError(errorMessage || t("common.failed_to_load_organizations"));
        }
        setIsLoadingOrganizations(false);
      });
    }
  }, [
    isOrganizationDropdownOpen,
    currentOrganizationId,
    organizations.length,
    isLoadingOrganizations,
    loadError,
    t,
  ]);

  if (!currentOrganization) {
    const errorMessage = `Organization not found for organization id: ${currentOrganizationId}`;
    logger.error(errorMessage);
    Sentry.captureException(new Error(errorMessage));
    return;
  }

  const workspaceBasePath = `/workspaces/${workspace?.id}`;

  const handleOrganizationChange = (organizationId: string) => {
    startTransition(() => {
      setIsOrganizationDropdownOpen(false);
      if (organizationId === currentOrganizationId && currentWorkspaceId) {
        router.push(`/workspaces/${currentWorkspaceId}/settings/general`);
        return;
      }
      router.push(`/organizations/${organizationId}/`);
    });
  };

  // Hide organization dropdown for single org setups (on-premise)
  const showOrganizationDropdown = isMultiOrgEnabled || organizations.length > 1;

  const handleSettingChange = (href: string) => {
    startTransition(() => {
      setIsOrganizationDropdownOpen(false);
      router.push(href);
    });
  };

  const organizationSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `${workspaceBasePath}/settings/general`,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `${workspaceBasePath}/settings/teams`,
    },
    {
      id: "feedback-record-directories",
      label: t("workspace.settings.feedback_record_directories.title"),
      href: `${workspaceBasePath}/settings/feedback-record-directories`,
      hidden: isMember,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `${workspaceBasePath}/settings/api-keys`,
      disabled: isMembershipPending || !isOwnerOrManager,
      disabledMessage: isMembershipPending
        ? t("common.loading")
        : t("common.you_are_not_authorized_to_perform_this_action"),
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `${workspaceBasePath}/settings/domain`,
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `${workspaceBasePath}/settings/billing`,
      hidden: !isFormbricksCloud,
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `${workspaceBasePath}/settings/enterprise`,
      hidden: isFormbricksCloud || isMember,
      disabled: isMembershipPending || isMember,
      disabledMessage: isMembershipPending
        ? t("common.loading")
        : t("common.you_are_not_authorized_to_perform_this_action"),
    },
  ];

  return (
    <BreadcrumbItem isActive={isOrganizationDropdownOpen}>
      <DropdownMenu onOpenChange={setIsOrganizationDropdownOpen}>
        <DropdownMenuTrigger
          className="flex cursor-pointer items-center gap-1 outline-none"
          id="organizationDropdownTrigger"
          asChild>
          <div className="flex items-center gap-1">
            <Building2Icon className="h-3 w-3" strokeWidth={1.5} />
            <span>{organizationName}</span>
            {isPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
            {isOrganizationDropdownOpen ? (
              <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <ChevronRightIcon className="h-3 w-3" strokeWidth={1.5} />
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="mt-2">
          {showOrganizationDropdown && (
            <>
              <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                <Building2Icon className="mr-2 inline h-4 w-4" />
                {t("common.choose_organization")}
              </div>
              {isLoadingOrganizations && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {!isLoadingOrganizations && loadError && (
                <div className="px-2 py-4">
                  <p className="mb-2 text-sm text-red-600">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      setOrganizations([]);
                    }}
                    className="text-xs text-slate-600 underline hover:text-slate-800">
                    {t("common.try_again")}
                  </button>
                </div>
              )}
              {!isLoadingOrganizations && !loadError && (
                <>
                  <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                    {organizations.map((org) => (
                      <DropdownMenuCheckboxItem
                        key={org.id}
                        checked={org.id === currentOrganizationId}
                        onClick={() => handleOrganizationChange(org.id)}
                        className="cursor-pointer">
                        {org.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                  {isMultiOrgEnabled && (
                    <DropdownMenuCheckboxItem
                      onClick={() => setOpenCreateOrganizationModal(true)}
                      className="cursor-pointer">
                      <span>{t("common.create_new_organization")}</span>
                      <PlusIcon className="ml-2 h-4 w-4" />
                    </DropdownMenuCheckboxItem>
                  )}
                </>
              )}
            </>
          )}
          {currentWorkspaceId && (
            <div>
              {showOrganizationDropdown && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                <SettingsIcon className="mr-2 inline h-4 w-4" />
                {t("common.organization_settings")}
              </div>

              {organizationSettings.map((setting) => {
                return setting.hidden ? null : (
                  <div key={setting.id}>
                    {setting.disabled ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-disabled="true"
                            className="relative flex w-full cursor-not-allowed select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm font-medium text-slate-400">
                            {setting.label}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
                          {setting.disabledMessage}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <DropdownMenuCheckboxItem
                        checked={isActiveOrganizationSetting(pathname, setting.id)}
                        onClick={() => handleSettingChange(setting.href)}
                        className="cursor-pointer">
                        {setting.label}
                      </DropdownMenuCheckboxItem>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {openCreateOrganizationModal && (
        <CreateOrganizationModal
          open={openCreateOrganizationModal}
          setOpen={setOpenCreateOrganizationModal}
        />
      )}
    </BreadcrumbItem>
  );
};
