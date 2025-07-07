"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { Button } from "@/modules/ui/components/button";
import { CodeActionForm } from "@/modules/ui/components/code-action-form";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { NoCodeActionForm } from "@/modules/ui/components/no-code-action-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/action-classes";

interface ActionSettingsTabProps {
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  setOpen: (v: boolean) => void;
  isReadOnly: boolean;
}

export const ActionSettingsTab = ({
  actionClass,
  actionClasses,
  setOpen,
  isReadOnly,
}: ActionSettingsTabProps) => {
  const { createdAt, updatedAt, id, ...restActionClass } = actionClass;
  const router = useRouter();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const { t } = useTranslate();
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);

  const actionClassNames = useMemo(
    () =>
      actionClasses.filter((action) => action.id !== actionClass.id).map((actionClass) => actionClass.name),
    [actionClass.id, actionClasses]
  );

  const form = useForm<TActionClassInput>({
    defaultValues: {
      ...restActionClass,
    },
    resolver: zodResolver(
      ZActionClassInput.superRefine((data, ctx) => {
        if (data.name && actionClassNames.includes(data.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["name"],
            message: t("environments.actions.action_with_name_already_exists", { name: data.name }),
          });
        }
      })
    ),

    mode: "onChange",
  });

  const { handleSubmit, control } = form;

  const onSubmit = async (data: TActionClassInput) => {
    try {
      if (isReadOnly) {
        throw new Error(t("common.you_are_not_authorised_to_perform_this_action"));
      }
      setIsUpdatingAction(true);

      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(t("environments.actions.action_with_name_already_exists", { name: data.name }));
      }

      if (
        data.type === "noCode" &&
        data.noCodeConfig?.type === "click" &&
        data.noCodeConfig.elementSelector.cssSelector &&
        !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
      ) {
        throw new Error(t("environments.actions.invalid_css_selector"));
      }

      const updatedData: TActionClassInput = {
        ...data,
        ...(data.type === "noCode" &&
          data.noCodeConfig?.type === "click" && {
            noCodeConfig: {
              ...data.noCodeConfig,
              elementSelector: {
                cssSelector: data.noCodeConfig.elementSelector.cssSelector,
                innerHtml: data.noCodeConfig.elementSelector.innerHtml,
              },
            },
          }),
      };
      await updateActionClassAction({
        actionClassId: actionClass.id,
        updatedAction: updatedData,
      });
      setOpen(false);
      router.refresh();
      toast.success(t("environments.actions.action_updated_successfully"));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpdatingAction(false);
    }
  };

  const handleDeleteAction = async () => {
    try {
      setIsDeletingAction(true);
      await deleteActionClassAction({ actionClassId: actionClass.id });
      router.refresh();
      toast.success(t("environments.actions.action_deleted_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDeletingAction(false);
    }
  };

  return (
    <div>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="max-h-[400px] w-full space-y-4 overflow-y-auto">
            <div className="grid w-full grid-cols-2 gap-x-4">
              <div className="col-span-1">
                <FormField
                  control={control}
                  name="name"
                  disabled={isReadOnly}
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel htmlFor="actionNameSettingsInput">
                        {actionClass.type === "noCode"
                          ? t("environments.actions.what_did_your_user_do")
                          : t("environments.actions.display_name")}
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionNameSettingsInput"
                          {...field}
                          placeholder={t("environments.actions.eg_clicked_download")}
                          isInvalid={!!error?.message}
                          disabled={isReadOnly}
                        />
                      </FormControl>

                      <FormError />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-1">
                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="actionDescriptionSettingsInput">
                        {t("common.description")}
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionDescriptionSettingsInput"
                          {...field}
                          placeholder={t("environments.actions.user_clicked_download_button")}
                          value={field.value ?? ""}
                          disabled={isReadOnly}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {actionClass.type === "code" ? (
              <>
                <CodeActionForm form={form} isReadOnly={true} />
                <p className="text-sm text-slate-600">
                  {t("environments.actions.this_is_a_code_action_please_make_changes_in_your_code_base")}
                </p>
              </>
            ) : actionClass.type === "noCode" ? (
              <NoCodeActionForm form={form} isReadOnly={isReadOnly} />
            ) : (
              <p className="text-sm text-slate-600">
                {t(
                  "environments.actions.this_action_was_created_automatically_you_cannot_make_changes_to_it"
                )}
              </p>
            )}
          </div>

          <div className="flex justify-between gap-x-2 border-slate-200 pt-4">
            <div className="flex items-center gap-x-2">
              {!isReadOnly ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setOpenDeleteDialog(true)}
                  id="deleteActionModalTrigger">
                  <TrashIcon />
                  {t("common.delete")}
                </Button>
              ) : null}

              <Button variant="secondary" asChild>
                <Link href="https://formbricks.com/docs/actions/no-code" target="_blank">
                  {t("common.read_docs")}
                </Link>
              </Button>
            </div>

            {!isReadOnly ? (
              <div className="flex space-x-2">
                <Button type="submit" loading={isUpdatingAction}>
                  {t("common.save_changes")}
                </Button>
              </div>
            ) : null}
          </div>
        </form>
      </FormProvider>

      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        isDeleting={isDeletingAction}
        deleteWhat={t("common.action")}
        text={t("environments.actions.delete_action_text")}
        onDelete={handleDeleteAction}
      />
    </div>
  );
};
