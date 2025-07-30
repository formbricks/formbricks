"use client";

import { ActionNameDescriptionFields } from "@/modules/ui/components/action-name-description-fields";
import { Button } from "@/modules/ui/components/button";
import { CodeActionForm } from "@/modules/ui/components/code-action-form";
import { FormField } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";
import { NoCodeActionForm } from "@/modules/ui/components/no-code-action-form";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { ActionClass } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createActionClassAction } from "../actions";
import { buildActionObject } from "../lib/action-builder";
import { createActionClassZodResolver, useActionClassKeys, validatePermissions } from "../lib/action-utils";

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

  const actionClassKeys = useActionClassKeys(actionClasses);

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
    resolver: createActionClassZodResolver(actionClassNames, actionClassKeys, t),
    mode: "onChange",
  });

  const { control, handleSubmit, watch, reset } = form;
  const { isSubmitting } = form.formState;

  const submitHandler = async (data: TActionClassInput) => {
    try {
      validatePermissions(isReadOnly, t);
      const updatedAction = buildActionObject(data, environmentId, t);
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

            <ActionNameDescriptionFields
              control={control}
              isReadOnly={isReadOnly}
              nameInputId="actionNameInput"
              descriptionInputId="actionDescriptionInput"
            />

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
