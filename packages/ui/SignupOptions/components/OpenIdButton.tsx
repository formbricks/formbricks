import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { Button } from "../../Button";

export const OpenIdButton = ({
  text = "Continue with OpenId Connect",
  inviteUrl,
  directRedirect = false,
}: {
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
      className="w-full justify-center">
      {text}
    </Button>
  );
};
