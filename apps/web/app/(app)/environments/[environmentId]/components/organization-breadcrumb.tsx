"use client";

import * as Sentry from "@sentry/nextjs";
import { Building2Icon, ChevronDownIcon, ChevronRightIcon, Loader2, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useOrganization } from "../context/environment-context";

interface OrganizationBreadcrumbProps {
  currentOrganizationId: string;
  currentOrganizationName?: string;
  isMultiOrgEnabled: boolean;
  currentEnvironmentId?: string;
  isMembershipPending: boolean;
}

export const OrganizationBreadcrumb = ({
  currentOrganizationId,
  currentOrganizationName,
  isMultiOrgEnabled,
  currentEnvironmentId,
  isMembershipPending,
}: OrganizationBreadcrumbProps) => {
  const { t } = useTranslation();
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { organization: currentOrganization } = useOrganization();
  const organizationName = currentOrganization?.name || currentOrganizationName || "";

  useEffect(() => {
    if (isOrganizationDropdownOpen && organizations.length === 0 && !isLoadingOrganizations && !loadError) {
      setIsLoadingOrganizations(true);
      setLoadError(null);
      getOrganizationsForSwitcherAction({ organizationId: currentOrganizationId }).then((result) => {
        if (result?.data) {
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setOrganizations(sorted);
        } else {
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

  const showOrganizationDropdown = isMultiOrgEnabled || organizations.length > 1;

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
