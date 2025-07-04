"use client";

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
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";

interface PasswordConfirmationModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  oldEmail: string;
  newEmail: string;
  onConfirm: (password: string) => Promise<void>;
}

const PasswordConfirmationSchema = z.object({
  password: ZUserPassword,
});

type FormValues = z.infer<typeof PasswordConfirmationSchema>;

export const PasswordConfirmationModal = ({
  open,
  setOpen,
  oldEmail,
  newEmail,
  onConfirm,
}: PasswordConfirmationModalProps) => {
  const { t } = useTranslate();

  const form = useForm<FormValues>({
    resolver: zodResolver(PasswordConfirmationSchema),
  });
  const { isSubmitting, isDirty } = form.formState;

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      await onConfirm(data.password);
      form.reset();
    } catch (error) {
      form.setError("password", {
        message: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  };
  const handleCancel = () => {
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("auth.forgot-password.reset.confirm_password")}</DialogTitle>
          <DialogDescription>{t("auth.email-change.confirm_password_description")}</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogBody>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:justify-between sm:gap-4">
                  <p>
                    <strong>{t("auth.email-change.old_email")}:</strong>
                    <br /> {oldEmail.toLowerCase()}
                  </p>
                  <p>
                    <strong>{t("auth.email-change.new_email")}:</strong>
                    <br /> {newEmail.toLowerCase()}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <div>
                          <PasswordInput
                            id="password"
                            autoComplete="current-password"
                            placeholder="*******"
                            aria-placeholder="password"
                            aria-label="password"
                            aria-required="true"
                            required
                            className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                            value={field.value}
                            onChange={(password) => field.onChange(password)}
                          />
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="default"
                loading={isSubmitting}
                disabled={isSubmitting || !isDirty || oldEmail.toLowerCase() === newEmail.toLowerCase()}>
                {t("common.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
