"use client";

import * as Sentry from "@sentry/nextjs";
import { ChevronDownIcon, ChevronRightIcon, FoldersIcon, Loader2, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getWorkspacesForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { SwitcherDropdownBody } from "@/modules/settings/components/switcher-dropdown-body";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
  const [isPending, startTransition] = useTransition();

  const workspaceSwitcher = useSwitcherData(
    () => getWorkspacesForSwitcherAction({ organizationId: currentOrganizationId }),
    t("common.failed_to_load_workspaces"),
    (message) => {
      const error = new Error(message);
      logger.error(error, "Failed to load workspaces");
      Sentry.captureException(error);
    }
  );
  const { load: loadWorkspaces } = workspaceSwitcher;

  // Get current workspace name from context OR prop
  // Context is preferred, but prop is fallback for pages without EnvironmentContextWrapper
  const { workspace: currentWorkspace } = useWorkspace();
  const workspaceName = currentWorkspace?.name || currentWorkspaceName || "";

  // Lazy-load workspaces when dropdown opens (the hook guards against duplicate/looping loads).
  useEffect(() => {
    if (isWorkspaceDropdownOpen) {
      void loadWorkspaces();
    }
  }, [isWorkspaceDropdownOpen, loadWorkspaces]);

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
    if (!workspaceSwitcher.hasLoaded || workspaceSwitcher.isLoading) {
      return;
    }
    if (workspaceSwitcher.items.length >= organizationWorkspacesLimit) {
      setOpenLimitModal(true);
      return;
    }
    setOpenCreateWorkspaceModal(true);
  };

  const getLimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("workspace.settings.billing.upgrade"),
          href: `/organizations/${currentOrganizationId}/settings/billing`,
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
          ? `/organizations/${currentOrganizationId}/settings/enterprise`
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
          <SwitcherDropdownBody
            type="workspace"
            isLoading={workspaceSwitcher.isLoading}
            error={workspaceSwitcher.error}
            onRetry={workspaceSwitcher.retry}
            items={workspaceSwitcher.items}
            selectedId={currentWorkspaceId}
            onSelect={handleWorkspaceChange}>
            {isMembershipPending || !isOwnerOrManager ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="relative flex w-full cursor-not-allowed items-center justify-between rounded-lg py-1.5 pr-2 pl-8 text-sm font-medium text-slate-400 select-none">
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
          </SwitcherDropdownBody>
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
