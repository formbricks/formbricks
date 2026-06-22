"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
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
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { type TCreateWorkflowFormData, getCreateWorkflowFormSchema } from "../lib/validate-create-workflow";

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TCreateWorkflowFormData) => void;
  isCreating: boolean;
}

export const CreateWorkflowDialog = ({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
}: Readonly<CreateWorkflowDialogProps>) => {
  const { t } = useTranslation();

  const form = useForm<TCreateWorkflowFormData>({
    resolver: zodResolver(getCreateWorkflowFormSchema(t)),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  // Start each open with a clean form.
  useEffect(() => {
    if (open) {
      form.reset({ name: "", description: "" });
    }
  }, [open, form]);

  const handleValidSubmit = (data: TCreateWorkflowFormData) => {
    if (!isCreating) {
      onSubmit(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("workspace.workflows.create_workflow")}</DialogTitle>
          <DialogDescription>{t("workspace.workflows.create_workflow_description")}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleValidSubmit)}>
            <DialogBody unconstrained className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("common.workflow_name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("workspace.workflows.workflow_name_placeholder")}
                        isInvalid={Boolean(fieldState.error)}
                        autoFocus
                      />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.workflows.workflow_description_optional")}</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={3}
                        placeholder={t("workspace.workflows.workflow_description_placeholder")}
                        className={cn(
                          "flex min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50",
                          fieldState.error ? "border-red-500" : "border-slate-300"
                        )}
                      />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isCreating} disabled={isCreating || !form.formState.isValid}>
                {t("common.continue")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
