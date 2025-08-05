"use client";

import { cn } from "@/lib/cn";
import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { CreateProjectModal } from "@/modules/projects/components/create-project-modal";
import { ProjectLimitModal } from "@/modules/projects/components/project-limit-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { useTranslate } from "@tolgee/react";
import { BlendIcon, ChevronRightIcon, GlobeIcon, GlobeLockIcon, LinkIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

interface ProjectSwitcherProps {
  isCollapsed: boolean;
  isTextVisible: boolean;
  project: TProject;
  projects: TProject[];
  organization: TOrganization;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  environmentId: string;
  isOwnerOrManager: boolean;
  canDoRoleManagement: boolean;
}

export const ProjectSwitcher = ({
  isCollapsed,
  isTextVisible,
  organization,
  project,
  projects,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  environmentId,
  isOwnerOrManager,
  canDoRoleManagement,
}: ProjectSwitcherProps) => {
  const [openLimitModal, setOpenLimitModal] = useState(false);
  const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);

  const router = useRouter();

  const { t } = useTranslate();

  const handleEnvironmentChangeByProject = (projectId: string) => {
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
    if (isFormbricksCloud && organization.billing.plan !== "enterprise") {
      return [
        {
          text:
            organization.billing.plan === "free"
              ? t("common.start_free_trial")
              : t("environments.settings.billing.upgrade"),
          onClick: () => {
            setOpenLimitModal(false);
            router.push(`/environments/${environmentId}/settings/billing`);
          },
        },
        {
          text: t("common.learn_more"),
          onClick: () => {
            setOpenLimitModal(false);
            router.push(`/environments/${environmentId}/settings/billing`);
          },
        },
      ];
    } else {
      if (isLicenseActive) {
        return [
          {
            text: t("environments.settings.billing.get_in_touch"),
            href: "https://formbricks.com/upgrade-self-hosting-license",
            onClick: () => setOpenLimitModal(false),
          },
          {
            text: t("common.learn_more"),
            href: "https://formbricks.com/learn-more-self-hosting-license",
            onClick: () => setOpenLimitModal(false),
          },
        ];
      }

      return [
        {
          text:
            organization.billing.plan === "free"
              ? t("common.start_free_trial")
              : t("environments.settings.billing.get_in_touch"),
          href: "https://formbricks.com/upgrade-self-hosting-license",
          onClick: () => setOpenLimitModal(false),
        },
        {
          text: t("common.learn_more"),
          href: "https://formbricks.com/learn-more-self-hosting-license",
          onClick: () => setOpenLimitModal(false),
        },
      ];
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          id="projectDropdownTrigger"
          className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
          <div
            tabIndex={0}
            className={cn(
              "flex cursor-pointer flex-row items-center gap-3",
              isCollapsed ? "justify-center px-2" : "px-4"
            )}>
            <div className="rounded-lg bg-slate-900 p-1.5 text-slate-50">
              {project.config.channel === "website" ? (
                <GlobeIcon strokeWidth={1.5} />
              ) : project.config.channel === "app" ? (
                <GlobeLockIcon strokeWidth={1.5} />
              ) : project.config.channel === "link" ? (
                <LinkIcon strokeWidth={1.5} />
              ) : (
                <BlendIcon strokeWidth={1.5} />
              )}
            </div>
            {!isCollapsed && !isTextVisible && (
              <>
                <div className="grow overflow-hidden">
                  <p
                    title={project.name}
                    className={cn(
                      "ph-no-capture ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700 transition-opacity duration-200",
                      isTextVisible ? "opacity-0" : "opacity-100"
                    )}>
                    {project.name}
                  </p>
                  <p
                    className={cn(
                      "text-sm text-slate-500 transition-opacity duration-200",
                      isTextVisible ? "opacity-0" : "opacity-100"
                    )}>
                    {project.config.channel === "link"
                      ? t("common.link_and_email")
                      : capitalizeFirstLetter(project.config.channel)}
                  </p>
                </div>
                <ChevronRightIcon
                  className={cn(
                    "h-5 w-5 shrink-0 text-slate-700 transition-opacity duration-200 hover:text-slate-500",
                    isTextVisible ? "opacity-0" : "opacity-100"
                  )}
                />
              </>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          id="userDropdownInnerContentWrapper"
          side="right"
          sideOffset={10}
          alignOffset={-1}
          align="end">
          <DropdownMenuRadioGroup
            value={project!.id}
            onValueChange={(v) => handleEnvironmentChangeByProject(v)}>
            {projects.map((project) => (
              <DropdownMenuRadioItem value={project.id} className="cursor-pointer break-all" key={project.id}>
                <div>
                  {project.config.channel === "website" ? (
                    <GlobeIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  ) : project.config.channel === "app" ? (
                    <GlobeLockIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  ) : project.config.channel === "link" ? (
                    <LinkIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <BlendIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  )}
                </div>
                <div className="">{project?.name}</div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {isOwnerOrManager && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAddProject} icon={<PlusIcon className="mr-2 h-4 w-4" />}>
                <span>{t("common.add_project")}</span>
              </DropdownMenuItem>
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
          organizationId={organization.id}
          canDoRoleManagement={canDoRoleManagement}
        />
      )}
    </>
  );
};
