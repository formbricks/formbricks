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
import { getOrganizationsForSwitcherAction } from "@/app/(app)/environments/[environmentId]/actions";
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
import { useOrganization } from "../context/environment-context";

interface OrganizationBreadcrumbProps {
  currentOrganizationId: string;
  currentOrganizationName?: string; // Optional: pass directly if context not available
  isMultiOrgEnabled: boolean;
  currentEnvironmentId?: string;
  isFormbricksCloud: boolean;
  isMember: boolean;
  isOwnerOrManager: boolean;
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
  currentEnvironmentId,
  isFormbricksCloud,
  isMember,
  isOwnerOrManager,
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

  const handleOrganizationChange = (organizationId: string) => {
    if (organizationId === currentOrganizationId) return;
    startTransition(() => {
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
      href: `/environments/${currentEnvironmentId}/settings/general`,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `/environments/${currentEnvironmentId}/settings/teams`,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/environments/${currentEnvironmentId}/settings/api-keys`,
      hidden: !isOwnerOrManager,
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `/environments/${currentEnvironmentId}/settings/domain`,
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `/environments/${currentEnvironmentId}/settings/billing`,
      hidden: !isFormbricksCloud,
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/environments/${currentEnvironmentId}/settings/enterprise`,
      hidden: isFormbricksCloud || isMember,
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
          {currentEnvironmentId && (
            <div>
              {showOrganizationDropdown && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                <SettingsIcon className="mr-2 inline h-4 w-4" />
                {t("common.organization_settings")}
              </div>

              {organizationSettings.map((setting) => {
                return setting.hidden ? null : (
                  <DropdownMenuCheckboxItem
                    key={setting.id}
                    checked={isActiveOrganizationSetting(pathname, setting.id)}
                    hidden={setting.hidden}
                    onClick={() => handleSettingChange(setting.href)}
                    className="cursor-pointer">
                    {setting.label}
                  </DropdownMenuCheckboxItem>
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
