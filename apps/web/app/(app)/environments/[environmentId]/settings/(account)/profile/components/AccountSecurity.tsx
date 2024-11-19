"use client";

import { DisableTwoFactorModal } from "@/modules/ee/two-factor-auth/components/disable-two-factor-modal";
import { EnableTwoFactorModal } from "@/modules/ee/two-factor-auth/components/enable-two-factor-modal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Switch } from "@formbricks/ui/components/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";

interface AccountSecurityProps {
  user: TUser;
  isEnterpriseEdition: boolean;
  environmentId: string;
}

export const AccountSecurity = ({ user, isEnterpriseEdition, environmentId }: AccountSecurityProps) => {
  const t = useTranslations();
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [disableTwoFactorModalOpen, setDisableTwoFactorModalOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center space-x-4">
        <Switch
          checked={user.twoFactorEnabled}
          disabled={!isEnterpriseEdition && !user.twoFactorEnabled}
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
      {!isEnterpriseEdition && !user.twoFactorEnabled && (
        <UpgradePlanNotice
          message={t("environments.settings.profile.to_enable_two_factor_authentication_you_need_an_active")}
          textForUrl={t("common.enterprise_license")}
          url={`/environments/${environmentId}/settings/enterprise`}
        />
      )}
      <EnableTwoFactorModal open={twoFactorModalOpen} setOpen={setTwoFactorModalOpen} />
      <DisableTwoFactorModal open={disableTwoFactorModalOpen} setOpen={setDisableTwoFactorModalOpen} />
    </div>
  );
};
