"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { buildActionObject } from "@/modules/survey/editor/lib/action-builder";
import {
  createActionClassZodResolver,
  useActionClassKeys,
  validatePermissions,
} from "@/modules/survey/editor/lib/action-utils";
import { ActionNameDescriptionFields } from "@/modules/ui/components/action-name-description-fields";
import { Button } from "@/modules/ui/components/button";
import { CodeActionForm } from "@/modules/ui/components/code-action-form";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { NoCodeActionForm } from "@/modules/ui/components/no-code-action-form";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TActionClass, TActionClassInput } from "@formbricks/types/action-classes";

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

  const actionClassKeys = useActionClassKeys(actionClasses);

  const form = useForm<TActionClassInput>({
    defaultValues: {
      ...restActionClass,
    },
    resolver: createActionClassZodResolver(actionClassNames, actionClassKeys, t),

    mode: "onChange",
  });

  const { handleSubmit, control } = form;

  const renderActionForm = () => {
    if (actionClass.type === "code") {
      return (
        <>
          <CodeActionForm form={form} isReadOnly={true} />
          <p className="text-sm text-slate-600">
            {t("environments.actions.this_is_a_code_action_please_make_changes_in_your_code_base")}
          </p>
        </>
      );
    }

    if (actionClass.type === "noCode") {
      return <NoCodeActionForm form={form} isReadOnly={isReadOnly} />;
    }

    return (
      <p className="text-sm text-slate-600">
        {t("environments.actions.this_action_was_created_automatically_you_cannot_make_changes_to_it")}
      </p>
    );
  };

  const onSubmit = async (data: TActionClassInput) => {
    try {
      setIsUpdatingAction(true);
      validatePermissions(isReadOnly, t);
      const updatedAction = buildActionObject(data, actionClass.environmentId, t);

      await updateActionClassAction({
        actionClassId: actionClass.id,
        updatedAction: updatedAction,
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
    } catch {
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
            <ActionNameDescriptionFields
              control={control}
              isReadOnly={isReadOnly}
              nameInputId="actionNameSettingsInput"
              descriptionInputId="actionDescriptionSettingsInput"
            />

            {renderActionForm()}
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
