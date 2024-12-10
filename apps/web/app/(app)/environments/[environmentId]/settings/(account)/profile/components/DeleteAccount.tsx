"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import { Button } from "@/modules/ui/components/button";
import type { Session } from "next-auth";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

export const DeleteAccount = ({
  session,
  IS_FORMBRICKS_CLOUD,
  user,
  organizationsWithSingleOwner,
}: {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
  user: TUser;
  organizationsWithSingleOwner: TOrganization[];
}) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const t = useTranslations("environments.settings.profile");
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
        organizationsWithSingleOwner={organizationsWithSingleOwner}
      />
      <p className="text-sm text-slate-700">
        <strong>{t("warning_cannot_undo")}</strong>
      </p>
      <Button className="mt-4" variant="destructive" size="sm" onClick={() => setModalOpen(!isModalOpen)}>
        {t("confirm_delete_my_account")}
      </Button>
    </div>
  );
};
