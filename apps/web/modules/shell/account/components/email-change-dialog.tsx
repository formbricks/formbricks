"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";
import { AuthField } from "@/modules/auth/components/auth-field";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { PasswordInput } from "@/modules/ui/components/password-input";

interface EmailChangeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  oldEmail: string;
  newEmail: string;
  onConfirm: (password: string) => Promise<void>;
}

const ZPasswordConfirmation = z.object({
  password: ZUserPassword,
});

type TPasswordConfirmation = z.infer<typeof ZPasswordConfirmation>;

/** Asks for the current password before an email change goes out: the server re-checks it. */
export const EmailChangeDialog = ({
  open,
  setOpen,
  oldEmail,
  newEmail,
  onConfirm,
}: Readonly<EmailChangeDialogProps>) => {
  const { t } = useTranslation();

  const form = useForm<TPasswordConfirmation>({
    defaultValues: { password: "" },
    resolver: zodResolver(ZPasswordConfirmation),
  });
  const { isSubmitting } = form.formState;

  const onSubmit: SubmitHandler<TPasswordConfirmation> = async (data) => {
    try {
      await onConfirm(data.password);
      form.reset();
    } catch (error) {
      form.setError("password", {
        message: error instanceof Error ? error.message : t("common.something_went_wrong"),
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("auth.forgot-password.reset.confirm_password")}</DialogTitle>
          <DialogDescription>{t("auth.email-change.confirm_password_description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <DialogBody className="flex flex-col gap-5 px-1">
            <dl className="flex flex-col gap-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <dt className="font-medium text-slate-800">{t("auth.email-change.old_email")}</dt>
                <dd className="break-all text-slate-600">{oldEmail.toLowerCase()}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-800">{t("auth.email-change.new_email")}</dt>
                <dd className="break-all text-slate-600">{newEmail.toLowerCase()}</dd>
              </div>
            </dl>
            <AuthField
              id="email-change-password"
              label={t("common.password")}
              error={form.formState.errors.password?.message}>
              <PasswordInput
                id="email-change-password"
                autoComplete="current-password"
                required
                {...form.register("password")}
              />
            </AuthField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || oldEmail.toLowerCase() === newEmail.toLowerCase()}>
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
