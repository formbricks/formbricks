"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import type { Session } from "next-auth";
import { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { DeleteAccountModal } from "@formbricks/ui/DeleteAccountModal";

export const DeleteAccount = ({
  session,
  IS_FORMBRICKS_CLOUD,
  user,
}: {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
  user: TUser;
}) => {
  const [isModalOpen, setModalOpen] = useState(false);

  if (!session) {
    return null;
  }

  return (
    <div>
      <DeleteAccountModal
        open={isModalOpen}
        setOpen={setModalOpen}
        user={user}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        formbricksLogout={formbricksLogout}
      />
      <p className="text-sm text-slate-700">
        Delete your account with all personal data. <strong>This cannot be undone!</strong>
      </p>
      <Button className="mt-4" variant="warn" size="sm" onClick={() => setModalOpen(!isModalOpen)}>
        Delete my account
      </Button>
    </div>
  );
};
