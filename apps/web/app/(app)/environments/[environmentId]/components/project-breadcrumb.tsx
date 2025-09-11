"use client";

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
import * as Sentry from "@sentry/nextjs";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, ChevronRightIcon, CogIcon, FolderOpenIcon, Loader2, PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logger } from "@formbricks/logger";

interface ProjectBreadcrumbProps {
  currentProjectId: string;
  projects: { id: string; name: string }[];
  isOwnerOrManager: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  currentOrganizationId: string;
  currentEnvironmentId: string;
  isAccessControlAllowed: boolean;
  isEnvironmentBreadcrumbVisible: boolean;
}

export const ProjectBreadcrumb = ({
  currentProjectId,
  projects,
  isOwnerOrManager,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  currentOrganizationId,
  currentEnvironmentId,
  isAccessControlAllowed,
  isEnvironmentBreadcrumbVisible,
}: ProjectBreadcrumbProps) => {
  const { t } = useTranslate();
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);
  const [openLimitModal, setOpenLimitModal] = useState(false);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  const projectSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${currentEnvironmentId}/project/general`,
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      href: `/environments/${currentEnvironmentId}/project/look`,
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      href: `/environments/${currentEnvironmentId}/project/app-connection`,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: `/environments/${currentEnvironmentId}/project/integrations`,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `/environments/${currentEnvironmentId}/project/teams`,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: `/environments/${currentEnvironmentId}/project/languages`,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: `/environments/${currentEnvironmentId}/project/tags`,
    },
  ];

  const currentProject = projects.find((project) => project.id === currentProjectId);

  if (!currentProject) {
    const errorMessage = `Project not found for project id: ${currentProjectId}`;
    logger.error(errorMessage);
    Sentry.captureException(new Error(errorMessage));
    return;
  }

  const handleProjectChange = (projectId: string) => {
    if (projectId === currentProjectId) return;
    setIsLoading(true);
    router.push(`/projects/${projectId}/`);
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
            <FolderOpenIcon className="h-3 w-3" strokeWidth={1.5} />
            <span>{currentProject.name}</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
            {isProjectDropdownOpen ? (
              <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              isEnvironmentBreadcrumbVisible && <ChevronRightIcon className="h-3 w-3" strokeWidth={1.5} />
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="mt-2">
          <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
            <FolderOpenIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
            {t("common.choose_project")}
          </div>
          <DropdownMenuGroup>
            {projects.map((proj) => (
              <DropdownMenuCheckboxItem
                key={proj.id}
                checked={proj.id === currentProject.id}
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
              <span>{t("common.add_new_project")}</span>
              <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
            </DropdownMenuCheckboxItem>
          )}
          <DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
              <CogIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
              {t("common.project_configuration")}
            </div>
            {projectSettings.map((setting) => (
              <DropdownMenuCheckboxItem
                key={setting.id}
                checked={pathname.includes(setting.id)}
                onClick={() => router.push(setting.href)}
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
