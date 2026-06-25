"use client";

import * as Sentry from "@sentry/nextjs";
import { Building2Icon, ChevronDownIcon, ChevronRightIcon, Loader2, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useOrganization } from "../context/workspace-context";

interface OrganizationBreadcrumbProps {
  currentOrganizationId: string;
  currentOrganizationName?: string; // Optional: pass directly if context not available
  isMultiOrgEnabled: boolean;
  currentWorkspaceId?: string;
}

export const OrganizationBreadcrumb = ({
  currentOrganizationId,
  currentOrganizationName,
  isMultiOrgEnabled,
  currentWorkspaceId,
}: OrganizationBreadcrumbProps) => {
  const { t } = useTranslation();
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
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
    startTransition(() => {
      setIsOrganizationDropdownOpen(false);
      if (organizationId === currentOrganizationId) {
        router.push(`/organizations/${currentOrganizationId}/settings/general`);
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

  return (
    <BreadcrumbItem isActive={isOrganizationDropdownOpen}>
      <DropdownMenu onOpenChange={setIsOrganizationDropdownOpen}>
        <DropdownMenuTrigger
          className="flex cursor-pointer items-center gap-1 outline-hidden"
          id="organizationDropdownTrigger"
          asChild>
          <div className="flex items-center gap-1">
            <Building2Icon className="size-3" strokeWidth={1.5} />
            <span>{organizationName}</span>
            {isPending && <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />}
            {isOrganizationDropdownOpen ? (
              <ChevronDownIcon className="size-3" strokeWidth={1.5} />
            ) : (
              <ChevronRightIcon className="size-3" strokeWidth={1.5} />
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="mt-2">
          {showOrganizationDropdown && (
            <>
              <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                <Building2Icon className="mr-2 inline size-4" />
                {t("common.choose_organization")}
              </div>
              {isLoadingOrganizations && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
              {!isLoadingOrganizations && loadError && (
                <div className="px-2 py-4">
                  <p className="mb-2 text-sm text-red-600">{loadError}</p>
                  <button
                    type="button"
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
              )}
            </>
          )}
          {currentWorkspaceId && (
            <>
              {showOrganizationDropdown && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                onClick={() =>
                  handleSettingChange(`/organizations/${currentOrganizationId}/settings/general`)
                }
                className="cursor-pointer">
                <SettingsIcon className="mr-2 size-4" />
                {t("common.settings")}
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
};
