"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { Button } from "@/modules/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { resetPasswordAction } from "../lib/actions";

interface PasswordCardProps {
  user: { id: string; email: string };
}

/**
 * Changing a password is the emailed reset link, the same flow as "Forgot your password?": the action
 * mails it to the account address, and the person is signed out so the link is the way back in.
 */
export const PasswordCard = ({ user }: Readonly<PasswordCardProps>) => {
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);
  const { signOut } = useSignOut({ id: user.id, email: user.email });

  const handleSendLink = async () => {
    setIsSending(true);

    try {
      const result = await resetPasswordAction();
      if (result?.data) {
        toast.success(t("auth.forgot-password.email-sent.heading"));

        await signOut({
          reason: "password_reset",
          redirectUrl: "/auth/login",
          redirect: true,
          callbackUrl: "/auth/login",
          clearWorkspaceId: true,
        });
      } else {
        toast.error(getFormattedErrorMessage(result ?? {}));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("common.password")}</CardTitle>
        <CardDescription>{t("shell.account.password.description", { email: user.email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleSendLink} loading={isSending}>
          {t("shell.auth.forgot_password.submit")}
        </Button>
      </CardContent>
    </Card>
  );
};
