"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/action-classes";
import { TMembershipRole } from "@formbricks/types/memberships";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { CodeActionForm } from "@formbricks/ui/components/organisms/CodeActionForm";
import { NoCodeActionForm } from "@formbricks/ui/components/organisms/NoCodeActionForm";

interface ActionSettingsTabProps {
  actionClass: TActionClass;
  actionClasses: TActionClass[];
  setOpen: (v: boolean) => void;
  membershipRole?: TMembershipRole;
}

export const ActionSettingsTab = ({
  actionClass,
  actionClasses,
  setOpen,
  membershipRole,
}: ActionSettingsTabProps) => {
  const { createdAt, updatedAt, id, ...restActionClass } = actionClass;
  const router = useRouter();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const t = useTranslations();
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const { isViewer } = getAccessFlags(membershipRole);
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
      if (isViewer) {
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
                          disabled={actionClass.type === "automatic" ? true : false}
                        />
                      </FormControl>

                      <FormError />
                    </FormItem>
                  )}
                />
              </div>
              {!isViewer && (
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
                            disabled={actionClass.type === "automatic" ? true : false}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {actionClass.type === "code" ? (
              <>
                <CodeActionForm form={form} isEdit={true} />
                <p className="text-sm text-slate-600">
                  {t("environments.actions.this_is_a_code_action_please_make_changes_in_your_code_base")}
                </p>
              </>
            ) : actionClass.type === "noCode" ? (
              <NoCodeActionForm form={form} />
            ) : (
              <p className="text-sm text-slate-600">
                {t(
                  "environments.actions.this_action_was_created_automatically_you_cannot_make_changes_to_it"
                )}
              </p>
            )}
          </div>

          <div className="flex justify-between border-t border-slate-200 py-6">
            <div>
              {!isViewer && actionClass.type !== "automatic" && (
                <Button
                  type="button"
                  variant="warn"
                  onClick={() => setOpenDeleteDialog(true)}
                  StartIcon={TrashIcon}
                  className="mr-3"
                  id="deleteActionModalTrigger">
                  {t("common.delete")}
                </Button>
              )}

              <Button variant="secondary" href="https://formbricks.com/docs/actions/no-code" target="_blank">
                {t("common.read_docs")}
              </Button>
            </div>

            {actionClass.type !== "automatic" && (
              <div className="flex space-x-2">
                <Button type="submit" loading={isUpdatingAction}>
                  {t("common.save_changes")}
                </Button>
              </div>
            )}
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
