"use client";

import * as Sentry from "@sentry/nextjs";
import {
  BuildingIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
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

interface OrganizationBreadcrumbProps {
  currentOrganizationId: string;
  organizations: { id: string; name: string }[];
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
  organizations,
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
  const [isLoading, setIsLoading] = useState(false);
  const currentOrganization = organizations.find((org) => org.id === currentOrganizationId);

  useEffect(() => {
    setIsLoading(false);
  }, [pathname]);

  if (!currentOrganization) {
    const errorMessage = `Organization not found for organization id: ${currentOrganizationId}`;
    logger.error(errorMessage);
    Sentry.captureException(new Error(errorMessage));
    return;
  }

  const handleOrganizationChange = (organizationId: string) => {
    if (organizationId === currentOrganizationId) return;
    setIsLoading(true);
    router.push(`/organizations/${organizationId}/`);
  };

  // Hide organization dropdown for single org setups (on-premise)
  const showOrganizationDropdown = isMultiOrgEnabled || organizations.length > 1;

  const handleSettingChange = (href: string) => {
    setIsLoading(true);
    setIsOrganizationDropdownOpen(false);
    router.push(href);
  };

  const organizationSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${currentEnvironmentId}/settings/general`,
    },
    {
      id: "teams",
      label: t("common.teams"),
      href: `/environments/${currentEnvironmentId}/settings/teams`,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/environments/${currentEnvironmentId}/settings/api-keys`,
      hidden: !isOwnerOrManager,
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
            <BuildingIcon className="h-3 w-3" strokeWidth={1.5} />
            <span>{currentOrganization.name}</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
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
                <BuildingIcon className="mr-2 inline h-4 w-4" />
                {t("common.choose_organization")}
              </div>
              <DropdownMenuGroup>
                {organizations.map((org) => (
                  <DropdownMenuCheckboxItem
                    key={org.id}
                    checked={org.id === currentOrganization.id}
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
          {currentEnvironmentId && (
            <div>
              <DropdownMenuSeparator />
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
