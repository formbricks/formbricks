import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { FaMicrosoft } from "react-icons/fa";

import { Button } from "@formbricks/ui/Button";

export const AzureButton = ({
  text = "Continue with Azure",
  inviteUrl,
  directRedirect = false,
}: {
  text?: string;
  inviteUrl?: string | null;
  directRedirect?: boolean;
}) => {
  const handleLogin = useCallback(async () => {
    await signIn("azure-ad", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/",
    });
  }, [inviteUrl]);

  useEffect(() => {
    if (directRedirect) {
      handleLogin();
    }
  }, [directRedirect, handleLogin]);

  return (
    <Button
      type="button"
      EndIcon={FaMicrosoft}
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
