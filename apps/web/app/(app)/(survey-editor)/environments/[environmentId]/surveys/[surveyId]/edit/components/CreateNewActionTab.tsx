import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  TActionClass,
  TActionClassInput,
  TActionClassInputCode,
  ZActionClassInput,
} from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { TabToggle } from "@formbricks/ui/TabToggle";
import { CodeActionForm } from "@formbricks/ui/organisms/CodeActionForm";
import { NoCodeActionForm } from "@formbricks/ui/organisms/NoCodeActionForm";
import { createActionClassAction } from "../actions";

interface CreateNewActionTabProps {
  actionClasses: TActionClass[];
  setActionClasses: React.Dispatch<React.SetStateAction<TActionClass[]>>;
  isViewer: boolean;
  setLocalSurvey?: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
}

export const CreateNewActionTab = ({
  actionClasses,
  setActionClasses,
  setOpen,
  isViewer,
  setLocalSurvey,
  environmentId,
}: CreateNewActionTabProps) => {
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
            message: `Action with name ${data.name} already exists`,
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
      if (isViewer) {
        throw new Error("You are not authorised to perform this action.");
      }

      if (data.name && actionClassNames.includes(data.name)) {
        throw new Error(`Action with name ${data.name} already exist`);
      }

      if (type === "code" && data.key && actionClassKeys.includes(data.key)) {
        throw new Error(`Action with key ${data.key} already exist`);
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
        setActionClasses((prevActionClasses: TActionClass[]) => [...prevActionClasses, newActionClass]);
      }

      if (setLocalSurvey) {
        setLocalSurvey((prev) => ({
          ...prev,
          triggers: prev.triggers.concat({ actionClass: newActionClass }),
        }));
      }

      reset();
      resetAllStates();
      toast.success("Action created successfully");
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
          <div className="max-h-[400px] w-full space-y-4 overflow-y-auto">
            <div className="w-3/5">
              <FormField
                name={`type`}
                control={control}
                render={({ field }) => (
                  <div>
                    <Label className="font-semibold">Type</Label>
                    <TabToggle
                      id="type"
                      options={[
                        { value: "noCode", label: "No code" },
                        { value: "code", label: "Code" },
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
                      <FormLabel htmlFor="actionNameInput">What did your user do?</FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionNameInput"
                          {...field}
                          placeholder="E.g. Clicked Download"
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
                      <FormLabel htmlFor="actionDescriptionInput">Description</FormLabel>

                      <FormControl>
                        <Input
                          type="text"
                          id="actionDescriptionInput"
                          {...field}
                          placeholder="User clicked Download Button"
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
              <CodeActionForm form={form} isEdit={false} />
            ) : (
              <NoCodeActionForm form={form} />
            )}
          </div>
          <div className="flex justify-end pt-6">
            <div className="flex space-x-2">
              <Button type="button" variant="minimal" onClick={resetAllStates}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Create action
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
