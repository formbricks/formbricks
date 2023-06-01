"use client";

import { Button } from "@formbricks/ui";
import { signIn } from "next-auth/react";
import { FaGoogle } from "react-icons/fa";

export const GoogleButton = ({ text = "Continue with Google" }) => {
  const handleLogin = async () => {
    await signIn("google", {
      redirect: true,
      callbackUrl: "/", // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={FaGoogle}
      startIconClassName="ml-3"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
