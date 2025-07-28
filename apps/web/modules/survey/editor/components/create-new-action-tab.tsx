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
    try {
      await validateActionData(data);
      const updatedAction = buildActionObject(data, environmentId);
      await createAndHandleAction(updatedAction);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const validateActionData = async (data: TActionClassInput) => {
    validatePermissions();
    validateActionNames(data);
    validateActionKeys(data);
    validateCssSelector(data);
    validateRegexPatterns(data);
  };

  const validatePermissions = () => {
    if (isReadOnly) {
      throw new Error(t("common.you_are_not_authorised_to_perform_this_action"));
    }
  };

  const validateActionNames = (data: TActionClassInput) => {
    if (data.name && actionClassNames.includes(data.name)) {
      throw new Error(t("environments.actions.action_with_name_already_exists", { name: data.name }));
    }
  };

  const validateActionKeys = (data: TActionClassInput) => {
    if (data.type === "code" && data.key && actionClassKeys.includes(data.key)) {
      throw new Error(t("environments.actions.action_with_key_already_exists", { key: data.key }));
    }
  };

  const validateCssSelector = (data: TActionClassInput) => {
    if (
      data.type === "noCode" &&
      data.noCodeConfig?.type === "click" &&
      data.noCodeConfig.elementSelector.cssSelector &&
      !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
    ) {
      throw new Error(t("environments.actions.invalid_css_selector"));
    }
  };

  const validateRegexPatterns = (data: TActionClassInput) => {
    if (data.type === "noCode" && data.noCodeConfig?.urlFilters) {
      for (const urlFilter of data.noCodeConfig.urlFilters) {
        if (urlFilter.rule === "matchesRegex") {
          try {
            new RegExp(urlFilter.value);
          } catch {
            throw new Error(t("environments.actions.invalid_regex"));
          }
        }
      }
    }
  };

  const buildActionObject = (data: TActionClassInput, environmentId: string) => {
    if (data.type === "noCode") {
      return buildNoCodeAction(data, environmentId);
    }
    return buildCodeAction(data, environmentId);
  };

  const buildNoCodeAction = (data: TActionClassInput, environmentId: string) => {
    const noCodeData = data as Extract<TActionClassInput, { type: "noCode" }>;
    const baseAction = {
      name: noCodeData.name.trim(),
      description: noCodeData.description,
      environmentId,
      type: "noCode" as const,
      noCodeConfig: noCodeData.noCodeConfig,
    };

    if (noCodeData.noCodeConfig?.type === "click") {
      return {
        ...baseAction,
        noCodeConfig: {
          ...noCodeData.noCodeConfig,
          elementSelector: {
            cssSelector: noCodeData.noCodeConfig.elementSelector.cssSelector,
            innerHtml: noCodeData.noCodeConfig.elementSelector.innerHtml,
          },
        },
      };
    }

    return baseAction;
  };

  const buildCodeAction = (data: TActionClassInput, environmentId: string) => {
    const codeData = data as Extract<TActionClassInput, { type: "code" }>;
    return {
      name: codeData.name.trim(),
      description: codeData.description,
      environmentId,
      type: "code" as const,
      key: codeData.key,
    };
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
        <form onSubmit={handleSubmit(submitHandler)}>
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
