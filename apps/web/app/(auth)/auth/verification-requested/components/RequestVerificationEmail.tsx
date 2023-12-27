"use client";

import { resendVerificationEmail } from "@/app/lib/users/users";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";

interface RequestEmailVerificationProps {
  email: string | null;
}

export const RequestVerificationEmail = ({ email }: RequestEmailVerificationProps) => {
  const requestVerificationEmail = async () => {
    try {
      if (!email) throw new Error("No email provided");
      await resendVerificationEmail(email);
      toast.success("Verification email successfully sent. Please check your inbox.");
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    }
  };
  return (
    <>
      <Button variant="secondary" onClick={requestVerificationEmail} className="w-full justify-center">
        Request a new verification mail
      </Button>
    </>
  );
};
