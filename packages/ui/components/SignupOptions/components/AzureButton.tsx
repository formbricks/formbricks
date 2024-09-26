import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { Button } from "../../Button";
import { MicrosoftIcon } from "../../icons";

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
      EndIcon={MicrosoftIcon}
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
