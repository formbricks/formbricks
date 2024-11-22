"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { addTeamProjectsAction } from "@/modules/ee/teams/team-details/actions";
import { UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { MultiSelect } from "@formbricks/ui/components/MultiSelect";
import { H4 } from "@formbricks/ui/components/Typography";

interface AddTeamProjectModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  teamId: string;
  projectOptions: { label: string; value: string }[];
}

export const AddTeamProjectModal = ({ open, setOpen, teamId, projectOptions }: AddTeamProjectModalProps) => {
  const t = useTranslations();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleAddProjects = async (e) => {
    e.preventDefault();

    setIsLoading(true);

    const addMembersActionResponse = await addTeamProjectsAction({
      teamId,
      projectIds: selectedProjects,
    });
    if (addMembersActionResponse?.data) {
      toast.success(t("environments.settings.teams.members_added_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(addMembersActionResponse);
      toast.error(errorMessage);
    }

    setSelectedProjects([]);
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Modal noPadding size="md" open={open} setOpen={setOpen} className="overflow-visible">
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UserIcon className="h-5 w-5" />
            <H4>{t("environments.settings.teams.add_projects")}</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleAddProjects}>
        <div className="overflow-visible p-6">
          <Label className="mb-1 text-sm font-medium text-slate-900">
            {t("environments.settings.teams.organization_projects")}
          </Label>
          <MultiSelect
            value={selectedProjects}
            options={projectOptions}
            onChange={(value) => {
              setSelectedProjects(value);
            }}
          />
        </div>
        <div className="flex items-end justify-end gap-2 p-6 pt-0">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false);
              setSelectedProjects([]);
            }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isLoading} loading={isLoading} type="submit">
            {t("common.add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
