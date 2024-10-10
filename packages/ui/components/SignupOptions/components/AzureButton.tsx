import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { Button } from "../../Button";
import { MicrosoftIcon } from "../../icons";

export const AzureButton = ({
  lastUsed,
  text = "Continue with Azure",
  inviteUrl,
  directRedirect = false,
}: {
  lastUsed?: boolean;
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
      className="relative w-full justify-center">
      {text}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">Last Used</span>}
    </Button>
  );
};
