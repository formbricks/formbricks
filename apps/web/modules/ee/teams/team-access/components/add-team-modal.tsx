"use client";

import { addAccessAction } from "@/modules/ee/teams/team-access/actions";
import { UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { MultiSelect } from "@formbricks/ui/components/MultiSelect";
import { H4 } from "@formbricks/ui/components/Typography";

interface AddTeamModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  teamOptions: { label: string; value: string }[];
  productId: string;
}

export const AddTeamModal = ({ open, setOpen, teamOptions, productId }: AddTeamModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const router = useRouter();

  const handleAddTeam = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    const addTeamActionResponse = await addAccessAction({ productId, teamIds: selectedTeams });

    if (addTeamActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(addTeamActionResponse);
      toast.error(errorMessage);
    }
    setSelectedTeams([]);
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Modal
      noPadding
      closeOnOutsideClick={true}
      size="md"
      open={open}
      setOpen={setOpen}
      className="overflow-visible">
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UsersIcon className="h-5 w-5" />
            <H4>Add Team</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleAddTeam}>
        <div className="overflow-visible p-6">
          <Label htmlFor="team-name" className="mb-1 text-sm font-medium text-slate-900">
            Select teams
          </Label>
          <MultiSelect
            value={selectedTeams}
            options={teamOptions}
            onChange={(value) => {
              setSelectedTeams(value);
            }}
          />
        </div>
        <div className="flex items-end justify-end gap-2 p-6 pt-0">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false);
              setSelectedTeams([]);
            }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isLoading} loading={isLoading} type="submit">
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
};
