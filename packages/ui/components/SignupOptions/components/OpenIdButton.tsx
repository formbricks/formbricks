import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { Button } from "../../Button";

export const OpenIdButton = ({
  lastUsed,
  text = "Continue with OpenId Connect",
  inviteUrl,
  directRedirect = false,
}: {
  lastUsed?: boolean;
  text?: string;
  inviteUrl?: string | null;
  directRedirect?: boolean;
}) => {
  const handleLogin = useCallback(async () => {
    await signIn("openid", {
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
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {text}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">Last Used</span>}
    </Button>
  );
};
