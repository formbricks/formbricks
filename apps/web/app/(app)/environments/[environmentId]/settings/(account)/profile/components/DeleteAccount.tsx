"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteAccountModal } from "@formbricks/ui/components/DeleteAccountModal";

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
  const router = useRouter();

  const handleAccountDeletion = async () => {
    setModalOpen(true);
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isModalOpen) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });
    router.push("/auth/login");
  };

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
      <Button className="mt-4" variant="warn" size="sm" onClick={handleAccountDeletion}>
        Delete my account
      </Button>
    </div>
  );
};