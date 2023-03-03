"use client";

import { Button } from "@/components/ui/Button";
import { toast, ToastContainer } from "react-toastify";
import { resendVerificationEmail } from "@/lib/users";

interface RequestEmailVerificationProps {
  email: string | null;
}

export const RequestVerificationEmail = ({ email }: RequestEmailVerificationProps) => {
  const requestVerificationEmail = async () => {
    try {
      if (!email) throw new Error("No email provided");
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
