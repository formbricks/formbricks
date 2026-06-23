"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { CreateWorkspaceModal } from "@/modules/workspaces/components/create-workspace-modal";

interface CreateFirstWorkspaceButtonProps {
  organizationId: string;
  isAccessControlAllowed: boolean;
}

// Escape hatch for an org owner/manager who landed here with zero workspaces: the server action
// behind the modal enforces the real workspace limit, so no client-side limit gating is needed.
export const CreateFirstWorkspaceButton = ({
  organizationId,
  isAccessControlAllowed,
}: Readonly<CreateFirstWorkspaceButtonProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        {t("common.create_workspace")}
      </Button>
      {open && (
        <CreateWorkspaceModal
          open={open}
          setOpen={setOpen}
          organizationId={organizationId}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      )}
    </>
  );
};
