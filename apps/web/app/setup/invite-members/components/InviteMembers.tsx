"use client";

import { inviteOrganizationMemberAction } from "@/app/setup/invite-members/actions";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "react-hot-toast";

import { isValidEmail } from "@formbricks/lib/utils/email";
import { Button } from "@formbricks/ui/Button";
import { FormbricksLogo } from "@formbricks/ui/FormbricksLogo";
import { Input } from "@formbricks/ui/Input";

export const InviteMembers = () => {
  const [teamMemberEmails, setTeamMemberEmails] = useState(["", "", ""]);
  const [isInviting, setIsInviting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const router = useRouter();

  const handleInputChange = (index, event) => {
    const newTeamMembers = [...teamMemberEmails];
    newTeamMembers[index] = event.target.value;
    setTeamMemberEmails(newTeamMembers);
  };

  const inviteTeamMembers = async () => {
    setIsInviting(true);
    const validEmails: string[] = [];

    // Validate all emails first
    for (const teamMemberEmail of teamMemberEmails) {
      if (teamMemberEmail.trim() !== "" && isValidEmail(teamMemberEmail)) {
        validEmails.push(teamMemberEmail);
      }
    }

    // If there are valid emails, proceed to send invitations
    if (validEmails.length === teamMemberEmails.length) {
      for (const email of validEmails) {
        try {
          await inviteOrganizationMemberAction(email);
          toast.success(`Invitation sent to: ${email}`);
        } catch (error) {
          console.error("Failed to invite:", email, error);
        }
      }
      router.push("/onboarding");
    } else {
      toast.error("Some emails are invalid. No invitations sent.");
    }

    setIsInviting(false);
  };

  const handleSkip = () => {
    setIsSkipping(true);
    router.push("/onboarding");
  };

  // Check if all input fields are empty
  const isButtonDisabled = teamMemberEmails.every((member) => member.trim() === "");

  return (
    <div className="flex w-[40rem] flex-col items-center space-y-4 rounded-lg border bg-white p-20 text-center shadow">
      <FormbricksLogo className="h-20 w-20 rounded-lg bg-black p-2" />
      <h2 className="text-2xl font-medium">Invite your team.</h2>
      <p>Life&apos;s no fun alone.</p>
      {teamMemberEmails.map((member, index) => (
        <Input
          key={index}
          placeholder={`member${index + 1}@web.com`}
          className="w-80"
          value={member}
          onChange={(e) => handleInputChange(index, e)}
        />
      ))}
      <div className="space-y-2">
        <Button
          variant="darkCTA"
          className="flex w-80 justify-center"
          onClick={inviteTeamMembers}
          loading={isInviting}
          disabled={isButtonDisabled}>
          Continue
        </Button>
        <Button
          variant="minimal"
          className="flex w-80 justify-center"
          onClick={handleSkip}
          loading={isSkipping}>
          Skip
        </Button>
      </div>
    </div>
  );
};
