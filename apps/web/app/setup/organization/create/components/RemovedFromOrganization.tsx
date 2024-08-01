"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import React, { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { DeleteAccountModal } from "@formbricks/ui/DeleteAccountModal";

interface RemovedFromOrganizationProps {
  isFormbricksCloud: boolean;
  user: TUser;
}

export const RemovedFromOrganization = ({ user, isFormbricksCloud }: RemovedFromOrganizationProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>No membership found!</AlertTitle>
        <AlertDescription>
          You are not a member of any organization at this time. If you believe this is a mistake, please
          reach out to the organization owner.
        </AlertDescription>
      </Alert>
      <hr className="my-4 border-slate-200" />
      <p className="text-sm">
        If you want to delete your account, you can do so by clicking the button below.
      </p>
      <DeleteAccountModal
        open={isModalOpen}
        setOpen={setIsModalOpen}
        user={user}
        isFormbricksCloud={isFormbricksCloud}
        formbricksLogout={formbricksLogout}
      />
      <Button onClick={() => setIsModalOpen(true)}>Delete account</Button>
    </div>
  );
};
