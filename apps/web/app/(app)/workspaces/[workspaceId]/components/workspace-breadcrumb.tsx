"use client";

import * as Sentry from "@sentry/nextjs";
import { ChevronDownIcon, ChevronRightIcon, CogIcon, FoldersIcon, Loader2, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getWorkspacesForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { CreateWorkspaceModal } from "@/modules/workspaces/components/create-workspace-modal";
import { WorkspaceLimitModal } from "@/modules/workspaces/components/workspace-limit-modal";
import { useWorkspace } from "../context/workspace-context";

interface WorkspaceBreadcrumbProps {
  currentWorkspaceId: string;
  currentWorkspaceName?: string; // Optional: pass directly if context not available
  isOwnerOrManager: boolean;
  organizationWorkspacesLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  currentOrganizationId: string;
  isAccessControlAllowed: boolean;
  isEnvironmentBreadcrumbVisible: boolean;
  isMembershipPending: boolean;
}

export const WorkspaceBreadcrumb = ({
  currentWorkspaceId,
  currentWorkspaceName,
  isOwnerOrManager,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  currentOrganizationId,
  isAccessControlAllowed,
  isEnvironmentBreadcrumbVisible,
  isMembershipPending,
}: WorkspaceBreadcrumbProps) => {
  const { t } = useTranslation();
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [openCreateWorkspaceModal, setOpenCreateWorkspaceModal] = useState(false);
  const [openLimitModal, setOpenLimitModal] = useState(false);
  const router = useRouter();
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Get current workspace name from context OR prop
  // Context is preferred, but prop is fallback for pages without EnvironmentContextWrapper
  const { workspace: currentWorkspace } = useWorkspace();
  const workspaceName = currentWorkspace?.name || currentWorkspaceName || "";

  const workspaceBasePath = `/workspaces/${currentWorkspace?.id}`;

  // Lazy-load workspaces when dropdown opens
  useEffect(() => {
    // Only fetch when dropdown opened for first time (and no error state)
    if (isWorkspaceDropdownOpen && workspaces.length === 0 && !isLoadingWorkspaces && !loadError) {
      setIsLoadingWorkspaces(true);
      setLoadError(null); // Clear any previous errors
      getWorkspacesForSwitcherAction({ organizationId: currentOrganizationId }).then((result) => {
        if (result?.data) {
          // Sort workspaces by name
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setWorkspaces(sorted);
        } else {
          // Handle server errors or validation errors
          const errorMessage = getFormattedErrorMessage(result);
          const error = new Error(errorMessage);
          logger.error(error, "Failed to load workspaces");
          Sentry.captureException(error);
          setLoadError(errorMessage || t("common.failed_to_load_workspaces"));
        }
        setIsLoadingWorkspaces(false);
      });
    }
  }, [isWorkspaceDropdownOpen, currentOrganizationId, workspaces.length, isLoadingWorkspaces, loadError, t]);

  if (!currentWorkspace) {
    const errorMessage = `Workspace not found for workspace id: ${currentWorkspaceId}`;
    logger.error(errorMessage);
    Sentry.captureException(new Error(errorMessage));
    return;
  }

  const handleWorkspaceChange = (workspaceId: string) => {
    const targetPath =
      workspaceId === currentWorkspaceId
        ? `/workspaces/${currentWorkspaceId}/surveys`
        : `/workspaces/${workspaceId}/`;
    startTransition(() => {
      setIsWorkspaceDropdownOpen(false);
      router.push(targetPath);
    });
  };

  const handleAddWorkspace = () => {
    if (workspaces.length >= organizationWorkspacesLimit) {
      setOpenLimitModal(true);
      return;
    }
    setOpenCreateWorkspaceModal(true);
  };

  const handleWorkspaceSettingsNavigation = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  const getLimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("workspace.settings.billing.upgrade"),
          href: `${workspaceBasePath}/settings/organization/billing`,
        },
        {
          text: t("common.cancel"),
          onClick: () => setOpenLimitModal(false),
        },
      ];
    }

    return [
      {
        text: t("workspace.settings.billing.upgrade"),
        href: isLicenseActive
          ? `${workspaceBasePath}/settings/organization/enterprise`
          : "https://formbricks.com/upgrade-self-hosted-license",
      },
      {
        text: t("common.cancel"),
        onClick: () => setOpenLimitModal(false),
      },
    ];
  };

  return (
    <BreadcrumbItem isActive={isWorkspaceDropdownOpen}>
      <DropdownMenu onOpenChange={setIsWorkspaceDropdownOpen}>
        <DropdownMenuTrigger className="flex cursor-pointer items-center gap-1 outline-none" asChild>
          <div className="flex items-center gap-1">
            <FoldersIcon className="size-3" strokeWidth={1.5} />
            <span>{workspaceName}</span>
            {isPending && <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />}
            {isEnvironmentBreadcrumbVisible && !isWorkspaceDropdownOpen ? (
              <ChevronRightIcon className="size-3" strokeWidth={1.5} />
            ) : (
              <ChevronDownIcon className="size-3" strokeWidth={1.5} />
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="mt-2">
          <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
            <FoldersIcon className="mr-2 inline size-4" strokeWidth={1.5} />
            {t("common.choose_workspace")}
          </div>
          {isLoadingWorkspaces && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {!isLoadingWorkspaces && loadError && (
            <div className="px-2 py-4">
              <p className="mb-2 text-sm text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setWorkspaces([]);
                }}
                className="text-xs text-slate-600 underline hover:text-slate-800">
                {t("common.try_again")}
              </button>
            </div>
          )}
          {!isLoadingWorkspaces && !loadError && (
            <>
              <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                {workspaces.map((ws) => (
                  <DropdownMenuCheckboxItem
                    key={ws.id}
                    checked={ws.id === currentWorkspaceId}
                    onClick={() => handleWorkspaceChange(ws.id)}
                    className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>{ws.name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              {isMembershipPending || !isOwnerOrManager ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-disabled="true"
                      className="relative flex w-full cursor-not-allowed select-none items-center justify-between rounded-lg py-1.5 pl-8 pr-2 text-sm font-medium text-slate-400">
                      <span>{t("common.add_new_workspace")}</span>
                      <PlusIcon className="ml-2 size-4" strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
                    {isMembershipPending
                      ? t("common.loading")
                      : t("common.you_are_not_authorized_to_perform_this_action")}
                  </PopoverContent>
                </Popover>
              ) : (
                <DropdownMenuCheckboxItem
                  onClick={handleAddWorkspace}
                  className="w-full cursor-pointer justify-between">
                  <span>{t("common.add_new_workspace")}</span>
                  <PlusIcon className="ml-2 size-4" strokeWidth={1.5} />
                </DropdownMenuCheckboxItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            onClick={() =>
              handleWorkspaceSettingsNavigation(`${workspaceBasePath}/settings/workspace/general`)
            }
            className="cursor-pointer">
            <CogIcon className="mr-2 size-4" strokeWidth={1.5} />
            {t("common.settings")}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Modals */}
      {openLimitModal && (
        <WorkspaceLimitModal
          open={openLimitModal}
          setOpen={setOpenLimitModal}
          buttons={getLimitModalButtons()}
          workspaceLimit={organizationWorkspacesLimit}
        />
      )}
      {openCreateWorkspaceModal && (
        <CreateWorkspaceModal
          open={openCreateWorkspaceModal}
          setOpen={setOpenCreateWorkspaceModal}
          organizationId={currentOrganizationId}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      )}
    </BreadcrumbItem>
  );
};
