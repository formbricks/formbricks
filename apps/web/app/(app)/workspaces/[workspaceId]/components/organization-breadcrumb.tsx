"use client";

import * as Sentry from "@sentry/nextjs";
import { Building2Icon, ChevronDownIcon, ChevronRightIcon, Loader2, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { SwitcherDropdownBody } from "@/modules/settings/components/switcher-dropdown-body";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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

  const organizationSwitcher = useSwitcherData(
    () => getOrganizationsForSwitcherAction({ organizationId: currentOrganizationId }),
    "common.failed_to_load_organizations",
    (message) => {
      const error = new Error(message);
      logger.error(error, "Failed to load organizations");
      Sentry.captureException(error);
    }
  );
  const { load: loadOrganizations } = organizationSwitcher;

  // Get current organization name from context OR prop
  // Context is preferred, but prop is fallback for pages without EnvironmentContextWrapper
  const { organization: currentOrganization } = useOrganization();
  const organizationName = currentOrganization?.name || currentOrganizationName || "";

  // Lazy-load organizations when dropdown opens (the hook guards against duplicate/looping loads).
  useEffect(() => {
    if (isOrganizationDropdownOpen) {
      void loadOrganizations();
    }
  }, [isOrganizationDropdownOpen, loadOrganizations]);

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
  const showOrganizationDropdown = isMultiOrgEnabled || organizationSwitcher.items.length > 1;

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
            <SwitcherDropdownBody
              type="organization"
              isLoading={organizationSwitcher.isLoading}
              error={organizationSwitcher.error}
              onRetry={organizationSwitcher.retry}
              items={organizationSwitcher.items}
              selectedId={currentOrganizationId}
              onSelect={handleOrganizationChange}
              showSettings={false}
            />
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
