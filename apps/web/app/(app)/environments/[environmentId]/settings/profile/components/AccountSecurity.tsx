"use client";

import DisableTwoFactorModal from "@/app/(app)/environments/[environmentId]/settings/profile/components/DisableTwoFactorModal";
import EnableTwoFactorModal from "@/app/(app)/environments/[environmentId]/settings/profile/components/EnableTwoFactorModal";
import { TProfile } from "@formbricks/types/v1/profile";
import { Switch } from "@formbricks/ui/Switch";
import React, { useState } from "react";

const AccountSecurity = ({ profile }: { profile: TProfile }) => {
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [disableTwoFactorModalOpen, setDisableTwoFactorModalOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center space-x-4">
        <Switch
          checked={profile.twoFactorEnabled}
          onCheckedChange={(checked) => {
            if (checked) {
              setTwoFactorModalOpen(true);
            } else {
              setDisableTwoFactorModalOpen(true);
            }
          }}
        />
        <div className="flex flex-col">
          <h1 className="text-base font-semibold">Two factor authentication</h1>

          <p className="text-sm">
            Add an extra layer of security to your account in case your password is stolen.
          </p>
        </div>
      </div>

      <EnableTwoFactorModal open={twoFactorModalOpen} setOpen={setTwoFactorModalOpen} />
      <DisableTwoFactorModal open={disableTwoFactorModalOpen} setOpen={setDisableTwoFactorModalOpen} />
    </div>
  );
};

export default AccountSecurity;
