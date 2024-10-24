"use client";

import { createTeamAction } from "@/modules/ee/teams/team-list/actions";
import { UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { H4 } from "@formbricks/ui/components/Typography";

interface CreateTeamModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organizationId: string;
}

export const CreateTeamModal = ({ open, setOpen, organizationId }: CreateTeamModalProps) => {
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleTeamCreation = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const name = teamName.trim();
    const createTeamActionResponse = await createTeamAction({ name, organizationId });
    if (createTeamActionResponse?.data) {
      toast.success("Team created successfully");
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
            <H4>Create Team</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleTeamCreation}>
        <div className="flex flex-col overflow-auto rounded-lg bg-white p-6">
          <Label htmlFor="team-name" className="mb-1 text-sm font-medium text-slate-900">
            Team name
          </Label>
          <Input
            id="team-name"
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value);
            }}
            placeholder="Enter team name"
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
            Cancel
          </Button>
          <Button variant="primary" disabled={!teamName || isLoading} loading={isLoading} type="submit">
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
};
