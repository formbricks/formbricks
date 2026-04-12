"use client";

import * as Sentry from "@sentry/nextjs";
import { ChevronDownIcon, ChevronRightIcon, FoldersIcon, Loader2, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getProjectsForSwitcherAction } from "@/app/(app)/environments/[environmentId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { CreateProjectModal } from "@/modules/projects/components/create-project-modal";
import { ProjectLimitModal } from "@/modules/projects/components/project-limit-modal";
import { BreadcrumbItem } from "@/modules/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { useProject } from "../context/environment-context";

interface ProjectBreadcrumbProps {
  currentProjectId: string;
  currentProjectName?: string;
  isOwnerOrManager: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  currentOrganizationId: string;
  currentEnvironmentId: string;
  isAccessControlAllowed: boolean;
  isEnvironmentBreadcrumbVisible: boolean;
  isBilling: boolean;
  isMembershipPending: boolean;
}

export const ProjectBreadcrumb = ({
  currentProjectId,
  currentProjectName,
  isOwnerOrManager,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  currentOrganizationId,
  currentEnvironmentId,
  isAccessControlAllowed,
  isEnvironmentBreadcrumbVisible,
  isMembershipPending,
}: ProjectBreadcrumbProps) => {
  const { t } = useTranslation();
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);
  const [openLimitModal, setOpenLimitModal] = useState(false);
  const router = useRouter();
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { project: currentProject } = useProject();
  const projectName = currentProject?.name || currentProjectName || "";

  useEffect(() => {
    if (isProjectDropdownOpen && projects.length === 0 && !isLoadingProjects && !loadError) {
      setIsLoadingProjects(true);
      setLoadError(null);
      getProjectsForSwitcherAction({ organizationId: currentOrganizationId }).then((result) => {
        if (result?.data) {
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setProjects(sorted);
        } else {
          const errorMessage = getFormattedErrorMessage(result);
          const error = new Error(errorMessage);
          logger.error(error, "Failed to load projects");
          Sentry.captureException(error);
          setLoadError(errorMessage || t("common.failed_to_load_workspaces"));
        }
        setIsLoadingProjects(false);
      });
    }
  }, [isProjectDropdownOpen, currentOrganizationId, projects.length, isLoadingProjects, loadError, t]);

  if (!currentProject) {
    const errorMessage = `Workspace not found for workspace id: ${currentProjectId}`;
    logger.error(errorMessage);
    Sentry.captureException(new Error(errorMessage));
    return;
  }

  const handleProjectChange = (projectId: string) => {
    if (projectId === currentProjectId) return;
    startTransition(() => {
      router.push(`/workspaces/${projectId}/`);
    });
  };

  const handleAddProject = () => {
    if (projects.length >= organizationProjectsLimit) {
      setOpenLimitModal(true);
      return;
    }
    setOpenCreateProjectModal(true);
  };

  const LimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("environments.settings.billing.upgrade"),
          href: `/environments/${currentEnvironmentId}/settings/organization/billing`,
        },
        {
          text: t("common.cancel"),
          onClick: () => setOpenLimitModal(false),
        },
      ];
    }

    return [
      {
        text: t("environments.settings.billing.upgrade"),
        href: isLicenseActive
          ? `/environments/${currentEnvironmentId}/settings/organization/enterprise`
          : "https://formbricks.com/upgrade-self-hosted-license",
      },
      {
        text: t("common.cancel"),
        onClick: () => setOpenLimitModal(false),
      },
    ];
  };

  return (
    <BreadcrumbItem isActive={isProjectDropdownOpen}>
      <DropdownMenu onOpenChange={setIsProjectDropdownOpen}>
        <DropdownMenuTrigger
          className="flex cursor-pointer items-center gap-1 outline-none"
          id="projectDropdownTrigger"
          asChild>
          <div className="flex items-center gap-1">
            <FoldersIcon className="h-3 w-3" strokeWidth={1.5} />
            <span>{projectName}</span>
            {isPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
            {isEnvironmentBreadcrumbVisible && !isProjectDropdownOpen ? (
              <ChevronRightIcon className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="mt-2">
          <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
            <FoldersIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
            {t("common.choose_workspace")}
          </div>
          {isLoadingProjects && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isLoadingProjects && loadError && (
            <div className="px-2 py-4">
              <p className="mb-2 text-sm text-red-600">{loadError}</p>
              <button
                onClick={() => {
                  setLoadError(null);
                  setProjects([]);
                }}
                className="text-xs text-slate-600 underline hover:text-slate-800">
                {t("common.try_again")}
              </button>
            </div>
          )}
          {!isLoadingProjects && !loadError && (
            <>
              <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                {projects.map((proj) => (
                  <DropdownMenuCheckboxItem
                    key={proj.id}
                    checked={proj.id === currentProjectId}
                    onClick={() => handleProjectChange(proj.id)}
                    className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>{proj.name}</span>
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
                      <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
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
                  onClick={handleAddProject}
                  className="w-full cursor-pointer justify-between">
                  <span>{t("common.add_new_workspace")}</span>
                  <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
                </DropdownMenuCheckboxItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {openLimitModal && (
        <ProjectLimitModal
          open={openLimitModal}
          setOpen={setOpenLimitModal}
          buttons={LimitModalButtons()}
          projectLimit={organizationProjectsLimit}
        />
      )}
      {openCreateProjectModal && (
        <CreateProjectModal
          open={openCreateProjectModal}
          setOpen={setOpenCreateProjectModal}
          organizationId={currentOrganizationId}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      )}
    </BreadcrumbItem>
  );
};
