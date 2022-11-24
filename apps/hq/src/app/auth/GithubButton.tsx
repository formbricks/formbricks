"use client";

import { Button } from "@formbricks/ui";
import { signIn } from "next-auth/react";
import { FaGithub } from "react-icons/fa";

export const GithubButton = ({ text = "Login with Github" }) => {
  const handleLogin = async () => {
    await signIn("github", {
      redirect: true,
      callbackUrl: "/", // redirect after login to /
    });
  };

  return (
    <Button
      StartIcon={FaGithub}
      startIconClassName="mr-2"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
