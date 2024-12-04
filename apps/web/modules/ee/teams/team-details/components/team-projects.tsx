"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import { updateTeamProjectPermissionAction } from "@/modules/ee/teams/team-details/actions";
import { AddTeamProjectModal } from "@/modules/ee/teams/team-details/components/add-team-project-modal";
import { TOrganizationProject, TTeamProject } from "@/modules/ee/teams/team-details/types/teams";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { removeTeamProjectAction } from "../actions";

interface TeamProjectsProps {
  membershipRole?: TOrganizationRole;
  projects: TTeamProject[];
  teamId: string;
  organizationProjects: TOrganizationProject[];
}

export const TeamProjects = ({
  membershipRole,
  projects,
  teamId,
  organizationProjects,
}: TeamProjectsProps) => {
  const t = useTranslations();
  const [openAddProjectModal, setOpenAddProjectModal] = useState<boolean>(false);
  const [removeProjectModalOpen, setRemoveProjectModalOpen] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleRemoveProject = async (projectId: string) => {
    const removeProjectActionResponse = await removeTeamProjectAction({
      teamId,
      projectId: projectId,
    });

    if (removeProjectActionResponse?.data) {
      toast.success(t("environments.settings.teams.project_removed_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeProjectActionResponse);
      toast.error(errorMessage);
    }

    setRemoveProjectModalOpen(false);
  };

  const handlePermissionChange = async (projectId: string, permission: TTeamPermission) => {
    const updateTeamPermissionResponse = await updateTeamProjectPermissionAction({
      teamId,
      projectId,
      permission,
    });
    if (updateTeamPermissionResponse?.data) {
      toast.success(t("environments.settings.teams.permission_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateTeamPermissionResponse);
      toast.error(errorMessage);
    }
  };

  const projectOptions = useMemo(
    () =>
      organizationProjects
        .filter((project) => !projects.find((p) => p.id === project.id))
        .map((project) => ({
          label: project.name,
          value: project.id,
        })),
    [organizationProjects, projects]
  );

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("environments.settings.teams.team_projects")}</CardTitle>
          <div className="flex gap-2">
            {isOwnerOrManager && (
              <Button variant="primary" size="sm" onClick={() => setOpenAddProjectModal(true)}>
                {t("environments.settings.teams.add_project")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>{t("environments.settings.teams.project_name")}</TableHead>
                  <TableHead>{t("environments.settings.teams.permission")}</TableHead>
                  {isOwnerOrManager && <TableHead>{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      {t("environments.settings.teams.empty_project_message")}
                    </TableCell>
                  </TableRow>
                )}
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-semibold">{project.name}</TableCell>
                    <TableCell>
                      {isOwnerOrManager ? (
                        <Select
                          value={project.permission}
                          onValueChange={(val: TTeamPermission) => {
                            handlePermissionChange(project.id, val);
                          }}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select type" className="text-sm" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ZTeamPermission.Enum.read}>
                              {t("environments.settings.teams.read")}
                            </SelectItem>
                            <SelectItem value={ZTeamPermission.Enum.readWrite}>
                              {t("environments.settings.teams.read_write")}
                            </SelectItem>
                            <SelectItem value={ZTeamPermission.Enum.manage}>
                              {t("environments.settings.teams.manage")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p>{TeamPermissionMapping[project.permission]}</p>
                      )}
                    </TableCell>
                    {isOwnerOrManager && (
                      <TableCell>
                        <Button
                          disabled={!isOwnerOrManager}
                          variant="warn"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setRemoveProjectModalOpen(true);
                          }}>
                          {t("common.remove")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {openAddProjectModal && (
        <AddTeamProjectModal
          teamId={teamId}
          open={openAddProjectModal}
          setOpen={setOpenAddProjectModal}
          projectOptions={projectOptions}
        />
      )}
      {removeProjectModalOpen && selectedProjectId && (
        <AlertDialog
          open={removeProjectModalOpen}
          setOpen={setRemoveProjectModalOpen}
          headerText={t("environments.settings.teams.remove_project")}
          mainText={t("environments.settings.teams.remove_project_confirmation")}
          confirmBtnLabel={t("common.confirm")}
          onDecline={() => {
            setSelectedProjectId(null);
            setRemoveProjectModalOpen(false);
          }}
          onConfirm={() => handleRemoveProject(selectedProjectId)}
        />
      )}
    </>
  );
};
