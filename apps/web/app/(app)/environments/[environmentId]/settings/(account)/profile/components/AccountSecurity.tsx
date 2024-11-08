"use client";

import { DisableTwoFactorModal } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/DisableTwoFactorModal";
import { EnableTwoFactorModal } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/EnableTwoFactorModal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Switch } from "@formbricks/ui/components/Switch";

export const AccountSecurity = ({ user }: { user: TUser }) => {
  const t = useTranslations();
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [disableTwoFactorModalOpen, setDisableTwoFactorModalOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center space-x-4">
        <Switch
          checked={user.twoFactorEnabled}
          onCheckedChange={(checked) => {
            if (checked) {
              setTwoFactorModalOpen(true);
            } else {
              setDisableTwoFactorModalOpen(true);
            }
          }}
        />
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-slate-800">
            {t("environments.settings.profile.two_factor_authentication")}
          </h1>

          <p className="text-xs text-slate-600">
            {t("environments.settings.profile.two_factor_authentication_description")}
          </p>
        </div>
      </div>

      <EnableTwoFactorModal open={twoFactorModalOpen} setOpen={setTwoFactorModalOpen} />
      <DisableTwoFactorModal open={disableTwoFactorModalOpen} setOpen={setDisableTwoFactorModalOpen} />
    </div>
  );
};
