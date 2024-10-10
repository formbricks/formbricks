import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { Button } from "../../Button";

export const OpenIdButton = ({
  text = "Continue with OpenId Connect",
  inviteUrl,
  directRedirect = false,
  lastUsed,
}: {
  text?: string;
  inviteUrl?: string | null;
  directRedirect?: boolean;
  lastUsed?: boolean;
}) => {
  const handleLogin = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("loggedInWith", "OpenID");
    }
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
      className={`relative w-full ${!lastUsed ? "justify-center" : "justify-start"}`}>
      {text}
      {lastUsed && <i className="absolute right-5">Last Used</i>}
    </Button>
  );
};
