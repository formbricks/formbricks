"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import {
  TFeedbackRecordDirectoryCreateInput,
  ZFeedbackRecordDirectoryCreateInput,
  getTranslatedFeedbackRecordDirectoryError,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface CreateFeedbackRecordDirectoryModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organizationId: string;
}

export const CreateFeedbackRecordDirectoryModal = ({
  open,
  setOpen,
  organizationId,
}: CreateFeedbackRecordDirectoryModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const form = useForm<TFeedbackRecordDirectoryCreateInput>({
    defaultValues: { name: "" },
    mode: "onChange",
    resolver: zodResolver(ZFeedbackRecordDirectoryCreateInput),
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = form;

  const handleCreation: SubmitHandler<TFeedbackRecordDirectoryCreateInput> = async (data) => {
    const response = await createFeedbackRecordDirectoryAction({ name: data.name, organizationId });
    if (response?.data) {
      toast.success(t("workspace.settings.feedback_record_directories.directory_created_successfully"));
      router.refresh();
      setOpen(false);
      reset();
    } else {
      const errorCode = getFormattedErrorMessage(response);
      toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("workspace.settings.feedback_record_directories.create_feedback_directory")}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(handleCreation)} className="gap-y-4 pt-4">
            <DialogBody>
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="pb-4">
                    <FormLabel>
                      {t("workspace.settings.feedback_record_directories.directory_name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("workspace.settings.feedback_record_directories.enter_directory_name")}
                        {...field}
                      />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />
            </DialogBody>

            <DialogFooter>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}>
                {t("common.cancel")}
              </Button>
              <Button disabled={!form.formState.isValid || isSubmitting} loading={isSubmitting} type="submit">
                {t("workspace.settings.feedback_record_directories.create_feedback_directory")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
