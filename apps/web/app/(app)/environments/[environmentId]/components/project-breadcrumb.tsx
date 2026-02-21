"use client";

import * as Sentry from "@sentry/nextjs";
import { ChevronDownIcon, ChevronRightIcon, CogIcon, HotelIcon, Loader2, PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { useProject } from "../context/environment-context";

interface ProjectBreadcrumbProps {
  currentProjectId: string;
  currentProjectName?: string; // Optional: pass directly if context not available
  isOwnerOrManager: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  currentOrganizationId: string;
  currentEnvironmentId: string;
  isAccessControlAllowed: boolean;
  isEnvironmentBreadcrumbVisible: boolean;
}

const isActiveProjectSetting = (pathname: string, settingId: string): boolean => {
  // Match /workspace/{settingId} or /workspace/{settingId}/... but exclude settings paths
  if (pathname.includes("/settings/")) {
    return false;
  }
  // Check if path matches /workspace/{settingId} (with optional trailing path)
  const pattern = new RegExp(`/workspace/${settingId}(?:/|$)`);
  return pattern.test(pathname);
};

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
  const pathname = usePathname();

  // Get current project name from context OR prop
  // Context is preferred, but prop is fallback for pages without EnvironmentContextWrapper
  const { project: currentProject } = useProject();
  const projectName = currentProject?.name || currentProjectName || "";

  // Lazy-load projects when dropdown opens
  useEffect(() => {
    // Only fetch when dropdown opened for first time (and no error state)
    if (isProjectDropdownOpen && projects.length === 0 && !isLoadingProjects && !loadError) {
      setIsLoadingProjects(true);
      setLoadError(null); // Clear any previous errors
      getProjectsForSwitcherAction({ organizationId: currentOrganizationId }).then((result) => {
        if (result?.data) {
          // Sort projects by name
          const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
          setProjects(sorted);
        } else {
          // Handle server errors or validation errors
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

  const projectSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${currentEnvironmentId}/workspace/general`,
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      href: `/environments/${currentEnvironmentId}/workspace/look`,
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      href: `/environments/${currentEnvironmentId}/workspace/app-connection`,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: `/environments/${currentEnvironmentId}/workspace/integrations`,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `/environments/${currentEnvironmentId}/workspace/teams`,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: `/environments/${currentEnvironmentId}/workspace/languages`,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: `/environments/${currentEnvironmentId}/workspace/tags`,
    },
  ];

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

  const handleProjectSettingsNavigation = (settingId: string) => {
    startTransition(() => {
      router.push(`/environments/${currentEnvironmentId}/workspace/${settingId}`);
    });
  };

  const LimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("environments.settings.billing.upgrade"),
          href: `/environments/${currentEnvironmentId}/settings/billing`,
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
          ? `/environments/${currentEnvironmentId}/settings/enterprise`
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
            <HotelIcon className="h-3 w-3" strokeWidth={1.5} />
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
            <HotelIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
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
              {isOwnerOrManager && (
                <DropdownMenuCheckboxItem
                  onClick={handleAddProject}
                  className="w-full cursor-pointer justify-between">
                  <span>{t("common.add_new_workspace")}</span>
                  <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
                </DropdownMenuCheckboxItem>
              )}
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
              <CogIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
              {t("common.workspace_configuration")}
            </div>
            {projectSettings.map((setting) => (
              <DropdownMenuCheckboxItem
                key={setting.id}
                checked={isActiveProjectSetting(pathname, setting.id)}
                onClick={() => handleProjectSettingsNavigation(setting.id)}
                className="cursor-pointer">
                {setting.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Modals */}
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
