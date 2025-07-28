"use client";

import { Button } from "@/modules/ui/components/button";
import { CodeActionForm } from "@/modules/ui/components/code-action-form";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { NoCodeActionForm } from "@/modules/ui/components/no-code-action-form";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionClass } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  TActionClassInput,
  TActionClassInputCode,
  ZActionClassInput,
} from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createActionClassAction } from "../actions";
import { buildActionObject } from "../lib/action-builder";
import { validateActionData } from "../lib/action-validation";

interface CreateNewActionTabProps {
  actionClasses: ActionClass[];
  setActionClasses: React.Dispatch<React.SetStateAction<ActionClass[]>>;
  isReadOnly: boolean;
  setLocalSurvey?: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
}

export const CreateNewActionTab = ({
  actionClasses,
  setActionClasses,
  setOpen,
  isReadOnly,
  setLocalSurvey,
  environmentId,
}: CreateNewActionTabProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const actionClassNames = useMemo(
    () => actionClasses.map((actionClass) => actionClass.name),
    [actionClasses]
  );

  const form = useForm<TActionClassInput>({
    defaultValues: {
      name: "",
      description: "",
      environmentId,
      type: "noCode",
      noCodeConfig: {
        type: "click",
        elementSelector: {
          cssSelector: undefined,
          innerHtml: undefined,
        },
        urlFilters: [],
      },
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

  const { control, handleSubmit, watch, reset } = form;
  const { isSubmitting } = form.formState;

  const actionClassKeys = useMemo(() => {
    const codeActionClasses: TActionClassInputCode[] = actionClasses.filter(
      (actionClass) => actionClass.type === "code"
    ) as TActionClassInputCode[];

    return codeActionClasses
      .map((actionClass) => actionClass.key)
      .filter((key): key is string => key !== null);
  }, [actionClasses]);

  const submitHandler = async (data: TActionClassInput) => {
    try {
      await validateActionData(data, isReadOnly, actionClassNames, actionClassKeys, t);
      const updatedAction = buildActionObject(data, environmentId);
      await createAndHandleAction(updatedAction);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createAndHandleAction = async (updatedAction: TActionClassInput) => {
    const createActionClassResposne = await createActionClassAction({
      action: updatedAction,
    });

    if (!createActionClassResposne?.data) return;

    const newActionClass = createActionClassResposne.data;

    if (setActionClasses) {
      setActionClasses((prevActionClasses: ActionClass[]) => [...prevActionClasses, newActionClass]);
    }

    if (setLocalSurvey) {
      setLocalSurvey((prev) => ({
        ...prev,
        triggers: prev.triggers.concat({ actionClass: newActionClass }),
      }));
    }

    reset();
    resetAllStates();
    router.refresh();
    toast.success(t("environments.actions.action_created_successfully"));
  };

  const resetAllStates = () => {
    reset();
    setOpen(false);
  };

  return (
    <div>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(submitHandler)} aria-label="create-action-form">
          <div className="w-full space-y-4">
            <div className="w-3/5">
              <FormField
                name={`type`}
                control={control}
                render={({ field }) => (
                  <div>
                    <Label className="font-semibold">{t("environments.actions.action_type")}</Label>
                    <TabToggle
                      id="type"
                      options={[
                        { value: "noCode", label: t("common.no_code") },
                        { value: "code", label: t("common.code") },
                      ]}
                      {...field}
                      defaultSelected={field.value}
                    />
                  </div>
                )}
              />
            </div>

            <div className="grid w-full grid-cols-2 gap-x-4">
              <div className="col-span-1">
                <FormField
                  control={control}
                  name="name"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel htmlFor="actionNameInput">
                        {t("environments.actions.what_did_your_user_do")}
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionNameInput"
                          {...field}
                          placeholder={t("environments.actions.eg_clicked_download")}
                          isInvalid={!!error?.message}
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
                      <FormLabel htmlFor="actionDescriptionInput">{t("common.description")}</FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionDescriptionInput"
                          {...field}
                          placeholder={t("environments.actions.eg_user_clicked_download_button")}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <hr className="border-slate-200" />

            {watch("type") === "code" ? (
              <CodeActionForm form={form} isReadOnly={isReadOnly} />
            ) : (
              <NoCodeActionForm form={form} isReadOnly={isReadOnly} />
            )}
          </div>
          <div className="sticky bottom-0 flex justify-end space-x-2 bg-white pt-4">
            <Button type="button" variant="secondary" onClick={resetAllStates}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("environments.actions.create_action")}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
