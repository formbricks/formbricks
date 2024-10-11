"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import type { Session } from "next-auth";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings.profile");
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
        <strong>{t("warning_cannot_undo")}</strong>
      </p>
      <Button className="mt-4" variant="warn" size="sm" onClick={() => setModalOpen(!isModalOpen)}>
        {t("confirm_delete_my_account")}
      </Button>
    </div>
  );
};
