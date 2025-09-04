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
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, ChevronRightIcon, FolderOpenIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

interface ProjectBreadcrumbProps {
  currentProject: TProject;
  projects: TProject[];
  isOwnerOrManager: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  currentOrganization: TOrganization;
  currentEnvironmentId: string;
  isAccessControlAllowed: boolean;
}

export const ProjectBreadcrumb = ({
  currentProject,
  projects,
  isOwnerOrManager,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  currentOrganization,
  currentEnvironmentId,
  isAccessControlAllowed,
}: ProjectBreadcrumbProps) => {
  const { t } = useTranslate();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);
  const [openLimitModal, setOpenLimitModal] = useState(false);
  const router = useRouter();

  const handleProjectChange = (projectId: string) => {
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
    if (isFormbricksCloud && currentOrganization.billing.plan !== "enterprise") {
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
      },
    ];
  };
  return (
    <BreadcrumbItem isActive={projectDropdownOpen}>
      <DropdownMenu onOpenChange={setProjectDropdownOpen}>
        <DropdownMenuTrigger className="flex items-center gap-1 outline-none">
          <FolderOpenIcon className="h-3 w-3" strokeWidth={1.5} />
          <span>{currentProject.name}</span>
          {projectDropdownOpen ? (
            <ChevronDownIcon className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <ChevronRightIcon className="h-3 w-3" strokeWidth={1.5} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="mt-2">
          <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
            <FolderOpenIcon className="mr-2 inline h-4 w-4" />
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
              <PlusIcon className="ml-2 h-4 w-4" />
            </DropdownMenuCheckboxItem>
          )}
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
          organizationId={currentOrganization.id}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      )}
    </BreadcrumbItem>
  );
};
