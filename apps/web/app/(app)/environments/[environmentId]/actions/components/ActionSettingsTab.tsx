"use client";

import {
  deleteActionClassAction,
  updateActionClassAction,
} from "@/app/(app)/environments/[environmentId]/actions/actions";
import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/action-classes";
import { TMembershipRole } from "@formbricks/types/memberships";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";
import { CodeActionForm } from "@formbricks/ui/organisms/CodeActionForm";
import { NoCodeActionForm } from "@formbricks/ui/organisms/NoCodeActionForm";

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
            message: `Action with name ${data.name} already exists`,
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
        throw new Error("You are not authorised to perform this action.");
      }
      setIsUpdatingAction(true);

      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }

      if (
        data.type === "noCode" &&
        data.noCodeConfig?.type === "click" &&
        data.noCodeConfig.elementSelector.cssSelector &&
        !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
      ) {
        throw new Error("Invalid CSS Selector");
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
      toast.success("Action updated successfully");
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
      toast.success("Action deleted successfully");
      setOpen(false);
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
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
                        {actionClass.type === "noCode" ? "What did your user do?" : "Display name"}
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionNameSettingsInput"
                          {...field}
                          placeholder="E.g. Clicked Download"
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
                        <FormLabel htmlFor="actionDescriptionSettingsInput">Description</FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            id="actionDescriptionSettingsInput"
                            {...field}
                            placeholder="User clicked Download Button"
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
                  This is a code action. Please make changes in your code base.
                </p>
              </>
            ) : actionClass.type === "noCode" ? (
              <NoCodeActionForm form={form} />
            ) : (
              <p className="text-sm text-slate-600">
                This action was created automatically. You cannot make changes to it.
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
                  Delete
                </Button>
              )}

              <Button variant="secondary" href="https://formbricks.com/docs/actions/no-code" target="_blank">
                Read Docs
              </Button>
            </div>

            {actionClass.type !== "automatic" && (
              <div className="flex space-x-2">
                <Button type="submit" loading={isUpdatingAction}>
                  Save changes
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
        deleteWhat={"Action"}
        text="Are you sure you want to delete this action? This also removes this action as a trigger from all your surveys."
        onDelete={handleDeleteAction}
      />
    </div>
  );
};
