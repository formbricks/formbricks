"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { deleteApiKeyAction } from "@/modules/organization/settings/api-keys/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { revokeOAuthConnectionAction } from "../actions";

interface RevokeConnectionButtonProps {
  organizationId: string;
  kind: "oauth" | "apiKey";
  id: string;
  name: string;
}

export const RevokeConnectionButton = ({
  organizationId,
  kind,
  id,
  name,
}: Readonly<RevokeConnectionButtonProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRevoke = () => {
    startTransition(async () => {
      const result =
        kind === "apiKey"
          ? await deleteApiKeyAction({ id })
          : await revokeOAuthConnectionAction({ id, organizationId });

      if (result?.data) {
        toast.success(t("shell.connections.revoked"));
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(
        (result && getFormattedErrorMessage(result)) || t("common.something_went_wrong_please_try_again")
      );
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t("shell.connections.revoke_named", { name })}
        onClick={() => setOpen(true)}>
        {t("auth.oauth.revoke")}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle>{t("shell.connections.revoke_title", { name })}</DialogTitle>
            <DialogDescription>
              {kind === "apiKey"
                ? t("shell.connections.revoke_api_key_description")
                : t("shell.connections.revoke_oauth_description", { name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" loading={isPending} onClick={handleRevoke}>
              {t("shell.connections.revoke_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
