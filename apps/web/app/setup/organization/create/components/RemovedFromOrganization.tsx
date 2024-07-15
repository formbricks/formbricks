"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { Session } from "next-auth";
import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { DeleteAccountModal } from "@formbricks/ui/DeleteAccountModal";

interface RemovedFromOrganizationProps {
  session: Session;
  isFormbricksCloud: boolean;
}

export const RemovedFromOrganization = ({ session, isFormbricksCloud }: RemovedFromOrganizationProps) => {
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
        session={session}
        isFormbricksCloud={isFormbricksCloud}
        formbricksLogout={formbricksLogout}
      />
      <Button variant="darkCTA" onClick={() => setIsModalOpen(true)}>
        Delete account
      </Button>
    </div>
  );
};
