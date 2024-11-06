"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { removeAccessAction, updateAccessPermissionAction } from "@/modules/ee/teams/product-teams/actions";
import { TProductTeam, TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";

interface AccessTableProps {
  teams: TProductTeam[];
  environmentId: string;
  productId: string;
  isOwnerOrManager: boolean;
}

export const AccessTable = ({ teams, environmentId, productId, isOwnerOrManager }: AccessTableProps) => {
  const t = useTranslations();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [removeAccessModalOpen, setRemoveAccessModalOpen] = useState<boolean>(false);

  const router = useRouter();

  const removeAccess = async (teamId: string) => {
    const removeAccessActionResponse = await removeAccessAction({ productId, teamId });
    if (removeAccessActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeAccessActionResponse);
      toast.error(errorMessage);
    }
  };

  const handlePermissionChange = async (teamId: string, permission: TTeamPermission) => {
    const updateAccessPermissionActionResponse = await updateAccessPermissionAction({
      productId,
      teamId,
      permission,
    });
    if (updateAccessPermissionActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateAccessPermissionActionResponse);
      toast.error(errorMessage);
    }
  };

  const handleRemoveAccess = (teamId: string) => {
    removeAccess(teamId);
    setRemoveAccessModalOpen(false);
    setSelectedTeamId(null);
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead>{t("environments.product.teams.team_name")}</TableHead>
              <TableHead>{t("environments.product.teams.permission")}</TableHead>
              {isOwnerOrManager && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  {t("environments.product.teams.no_items_added")}
                </TableCell>
              </TableRow>
            )}
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell>
                  {isOwnerOrManager ? (
                    <Link href={`/environments/${environmentId}/settings/teams/${team.id}`}>{team.name}</Link>
                  ) : (
                    team.name
                  )}
                  ({team.memberCount} members)
                </TableCell>
                <TableCell>
                  {isOwnerOrManager ? (
                    <Select
                      value={team.permission}
                      onValueChange={(val: TTeamPermission) => {
                        handlePermissionChange(team.id, val);
                      }}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select type" className="text-sm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ZTeamPermission.Enum.read}>
                          {t("environments.product.teams.read")}
                        </SelectItem>
                        <SelectItem value={ZTeamPermission.Enum.readWrite}>
                          {t("environments.product.teams.read_write")}
                        </SelectItem>
                        <SelectItem value={ZTeamPermission.Enum.manage}>
                          {t("environments.product.teams.manage")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="capitalize">{TeamPermissionMapping[team.permission]}</p>
                  )}
                </TableCell>
                {isOwnerOrManager && (
                  <TableCell>
                    <Button
                      variant="warn"
                      size="sm"
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setRemoveAccessModalOpen(true);
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

      {removeAccessModalOpen && selectedTeamId && (
        <AlertDialog
          open={removeAccessModalOpen}
          setOpen={setRemoveAccessModalOpen}
          headerText={t("environments.product.teams.remove_access")}
          mainText={t("environments.product.teams.remove_access_confirmation")}
          confirmBtnLabel={t("common.confirm")}
          onDecline={() => {
            setSelectedTeamId(null);
            setRemoveAccessModalOpen(false);
          }}
          onConfirm={() => handleRemoveAccess(selectedTeamId)}
        />
      )}
    </>
  );
};
