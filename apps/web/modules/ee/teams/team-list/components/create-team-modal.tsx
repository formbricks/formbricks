"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createTeamAction } from "@/modules/ee/teams/team-list/actions";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { H4 } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface CreateTeamModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organizationId: string;
  onCreate?: (teamId: string) => void;
}

export const CreateTeamModal = ({ open, setOpen, organizationId, onCreate }: CreateTeamModalProps) => {
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslate();
  const router = useRouter();

  const handleTeamCreation = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const name = teamName.trim();
    const createTeamActionResponse = await createTeamAction({ name, organizationId });
    if (createTeamActionResponse?.data) {
      toast.success(t("environments.settings.teams.team_created_successfully"));
      if (typeof onCreate === "function") {
        onCreate(createTeamActionResponse.data);
      }
      router.refresh();
      setOpen(false);
      setTeamName("");
    } else {
      const errorMessage = getFormattedErrorMessage(createTeamActionResponse);
      toast.error(errorMessage);
    }
    setIsLoading(false);
  };

  return (
    <Modal noPadding closeOnOutsideClick={true} size="md" open={open} setOpen={setOpen}>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UsersIcon className="h-5 w-5" />
            <H4>{t("environments.settings.teams.create_new_team")}</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleTeamCreation}>
        <div className="flex flex-col overflow-auto rounded-lg bg-white p-6">
          <Label htmlFor="team-name" className="mb-1 text-sm font-medium text-slate-900">
            {t("environments.settings.teams.team_name")}
          </Label>
          <Input
            id="team-name"
            name="team-name"
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value);
            }}
            placeholder={t("environments.settings.teams.enter_team_name")}
          />
        </div>
        <div className="flex items-end justify-end gap-2 p-6 pt-0">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false);
              setTeamName("");
            }}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!teamName || isLoading} loading={isLoading} type="submit">
            {t("environments.settings.teams.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
