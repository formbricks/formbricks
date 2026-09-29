"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
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

interface RenameSurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  surveyId: string;
  surveyName: string;
  renameSurvey: (surveyId: string, name: string) => Promise<void>;
}

// Mirrors ZV3SurveyName on the PATCH route: trimmed, at least one character.
const ZRenameSurveyForm = z.object({
  name: z.string().trim().min(1),
});

type TRenameSurveyForm = z.infer<typeof ZRenameSurveyForm>;

export const RenameSurveyModal = ({
  open,
  setOpen,
  surveyId,
  surveyName,
  renameSurvey,
}: Readonly<RenameSurveyModalProps>) => {
  const { t } = useTranslation();

  const form = useForm<TRenameSurveyForm>({
    resolver: zodResolver(ZRenameSurveyForm),
    defaultValues: { name: surveyName },
  });

  const wasOpen = useRef(open);

  // Re-seed on open only, so a cancelled edit does not linger. Deliberately not on every surveyName
  // change: a failed rename rolls the list row back, and re-seeding then would wipe what the user
  // typed just as they need it to retry.
  useEffect(() => {
    if (open && !wasOpen.current) {
      form.reset({ name: surveyName });
    }
    wasOpen.current = open;
  }, [open, surveyName, form]);

  const onSubmit = async ({ name }: TRenameSurveyForm) => {
    const nextName = name.trim();

    if (nextName === surveyName) {
      setOpen(false);
      return;
    }

    try {
      await renameSurvey(surveyId, nextName);
      toast.success(t("workspace.surveys.survey_renamed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.surveys.error_renaming_survey")));
    }
  };

  // Hold the dialog open until the rename settles. Cancel is already disabled, but the close button,
  // Escape and an outside click all reach setOpen directly — and closing mid-flight is the only way to
  // get two renames in flight on one query key, where the first failure's rollback would restore a
  // snapshot taken before the second and silently undo it.
  const handleOpenChange = (next: boolean) => {
    if (form.formState.isSubmitting) return;
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {/* DialogHeader pins its icon to the first line; center it on the title + description block. */}
        <DialogHeader className="[&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
          <PencilIcon />
          <DialogTitle>{t("workspace.surveys.rename_survey")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.rename_survey_description")}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <DialogBody unconstrained className="p-1">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        data-testid="rename-survey-input"
                        placeholder={t("workspace.surveys.rename_survey_placeholder")}
                      />
                    </FormControl>
                    {error && <FormError>{t("workspace.surveys.survey_name_required")}</FormError>}
                  </FormItem>
                )}
              />
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={form.formState.isSubmitting}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" data-testid="rename-survey-save" loading={form.formState.isSubmitting}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
