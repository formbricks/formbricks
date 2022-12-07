"use client";

import { Button } from "@formbricks/ui";
import { toast, ToastContainer } from "react-toastify";
import { resendVerificationEmail } from "@/lib/users";

interface RequestEmailVerificationProps {
  email: string;
}

export const RequestVerificationEmail = ({ email }: RequestEmailVerificationProps) => {
  const requestVerificationEmail = async () => {
    try {
      await resendVerificationEmail(email);
      toast("Verification email successfully sent. Please check your inbox.");
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    }
  };
  return (
    <>
      <ToastContainer />
      <Button onClick={() => requestVerificationEmail()} className="w-full justify-center">
        Request a new verification mail
      </Button>
    </>
  );
};
