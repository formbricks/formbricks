"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createTeamAction } from "@/modules/ee/teams/team-list/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <UsersIcon />
          <DialogTitle>{t("environments.settings.teams.create_new_team")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleTeamCreation} className="gap-y-4 pt-4">
          <DialogBody>
            <div className="grid w-full gap-y-2 pb-4">
              <Label htmlFor="team-name">{t("environments.settings.teams.team_name")}</Label>
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
          </DialogBody>

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
