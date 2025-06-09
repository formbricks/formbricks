"use client";

import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
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

    return codeActionClasses.map((actionClass) => actionClass.key);
  }, [actionClasses]);

  const submitHandler = async (data: TActionClassInput) => {
    const { type } = data;
    try {
      if (isReadOnly) {
        throw new Error(t("common.you_are_not_authorised_to_perform_this_action"));
      }

      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(t("environments.actions.action_with_name_already_exists", { name: data.name }));
      }

      if (type === "code" && data.key && actionClassKeys.includes(data.key)) {
        throw new Error(t("environments.actions.action_with_key_already_exists", { key: data.key }));
      }

      if (
        data.type === "noCode" &&
        data.noCodeConfig?.type === "click" &&
        data.noCodeConfig.elementSelector.cssSelector &&
        !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
      ) {
        throw new Error("Invalid CSS Selector");
      }

      let updatedAction = {};

      if (type === "noCode") {
        updatedAction = {
          name: data.name.trim(),
          description: data.description,
          environmentId,
          type: "noCode",
          noCodeConfig: {
            ...data.noCodeConfig,
            ...(data.type === "noCode" &&
              data.noCodeConfig?.type === "click" && {
                elementSelector: {
                  cssSelector: data.noCodeConfig.elementSelector.cssSelector,
                  innerHtml: data.noCodeConfig.elementSelector.innerHtml,
                },
              }),
          },
        };
      } else if (type === "code") {
        updatedAction = {
          name: data.name.trim(),
          description: data.description,
          environmentId,
          type: "code",
          key: data.key,
        };
      }

      // const newActionClass: TActionClass =
      const createActionClassResposne = await createActionClassAction({
        action: updatedAction as TActionClassInput,
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetAllStates = () => {
    reset();
    setOpen(false);
  };

  return (
    <div>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(submitHandler)}>
          <div className="max-h-[400px] w-full space-y-4 overflow-y-auto pr-4">
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
          <div className="flex justify-end pt-6">
            <div className="flex space-x-2">
              <Button type="button" variant="ghost" onClick={resetAllStates}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {t("environments.actions.create_action")}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
