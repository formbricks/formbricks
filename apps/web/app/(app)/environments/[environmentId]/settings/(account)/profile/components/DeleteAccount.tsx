"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { Session } from "next-auth";
import { useState } from "react";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { DeleteAccountModal } from "@formbricks/ui/DeleteAccountModal";

export const EditAvatar = ({ session }) => {
  return (
    <div>
      <ProfileAvatar userId={session.user.id} imageUrl={session.user.imageUrl} />

      <Button className="mt-4" variant="darkCTA" size="sm" disabled={true}>
        Upload Image
      </Button>
    </div>
  );
};

export const DeleteAccount = ({
  session,
  IS_FORMBRICKS_CLOUD,
}: {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
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
        session={session}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
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
