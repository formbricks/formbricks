"use client";

import { createOrganizationAction } from "@/app/setup/create-first-organization/actions";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

export const CreateFirstOrganization = () => {
  const [organizationName, setOrganizationName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createOrganization = async () => {
    try {
      setIsCreating(true);
      await createOrganizationAction(organizationName);
      router.push("/setup/invite-members");
    } catch (error) {
      setIsCreating(false);
      toast.error("Some error occurred while creating organization");
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <h2 className="text-2xl font-medium">Setup your organization</h2>
      <p>Make it yours.</p>
      <div>
        <Input
          placeholder="e.g., Acme Inc"
          className="w-80"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
        />
      </div>
      <Button
        variant="darkCTA"
        className="flex w-80 justify-center"
        onClick={createOrganization}
        loading={isCreating}
        disabled={organizationName.trim() === ""}>
        Continue
      </Button>
    </div>
  );
};
