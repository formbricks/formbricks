"use client";

import { createId } from "@paralleldrive/cuid2";
import { TrashIcon } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { FormControl, FormField, FormItem, FormProvider } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";

interface SurveyVariablesCardItemProps {
  variable?: TSurveyVariable;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  mode: "create" | "edit";
}

export const SurveyVariablesCardItem = ({
  variable,
  localSurvey,
  setLocalSurvey,
  mode,
}: SurveyVariablesCardItemProps) => {
  const form = useForm<TSurveyVariable>({
    defaultValues: variable ?? {
      id: createId(),
      name: "",
      type: "number",
      value: 0,
    },
    mode: "onChange",
  });

  const { errors } = form.formState;
  const isNameError = !!errors.name?.message;
  const variableType = form.watch("type");

  const editSurveyVariable = useCallback(
    (data: TSurveyVariable) => {
      setLocalSurvey((prevSurvey) => {
        const updatedVariables = prevSurvey.variables.map((v) => (v.id === data.id ? data : v));
        return { ...prevSurvey, variables: updatedVariables };
      });
    },
    [setLocalSurvey]
  );

  const createSurveyVariable = (data: TSurveyVariable) => {
    setLocalSurvey({
      ...localSurvey,
      variables: [...localSurvey.variables, data],
    });

    form.reset({
      id: createId(),
      name: "",
      type: "number",
      value: 0,
    });
  };

  useEffect(() => {
    if (mode === "create") {
      return;
    }

    const subscription = form.watch(() => form.handleSubmit(editSurveyVariable)());
    return () => subscription.unsubscribe();
  }, [form, mode, editSurveyVariable]);

  const onVaribleDelete = (variable: TSurveyVariable) => {
    const questions = [...localSurvey.questions];

    // find if this variable is used in any question's recall and remove it for every language

    questions.forEach((question) => {
      for (const [languageCode, headline] of Object.entries(question.headline)) {
        if (headline.includes(`recall:${variable.id}`)) {
          const recallInfo = extractRecallInfo(headline);
          if (recallInfo) {
            question.headline[languageCode] = headline.replace(recallInfo, "");
          }
        }
      }
    });

    setLocalSurvey((prevSurvey) => {
      const updatedVariables = prevSurvey.variables.filter((v) => v.id !== variable.id);
      return { ...prevSurvey, variables: updatedVariables, questions };
    });
  };

  if (mode === "edit" && !variable) {
    return null;
  }

  return (
    <div>
      <FormProvider {...form}>
        <form
          className="mt-5"
          onSubmit={form.handleSubmit((data) => {
            if (mode === "create") {
              createSurveyVariable(data);
            } else {
              editSurveyVariable(data);
            }
          })}>
          {mode === "create" && <Label htmlFor="headline">Add variable</Label>}

          <div className="mt-2 flex w-full items-center gap-2">
            <FormField
              control={form.control}
              name="name"
              rules={{
                pattern: {
                  value: /^[a-z0-9_]+$/,
                  message: "Only lower case letters, numbers, and underscores are allowed.",
                },
                validate: (value) => {
                  // if the variable name is already taken
                  if (
                    mode === "create" &&
                    localSurvey.variables.find((variable) => variable.name === value)
                  ) {
                    return "Variable name is already taken, please choose another.";
                  }

                  if (mode === "edit" && variable && variable.name !== value) {
                    if (localSurvey.variables.find((variable) => variable.name === value)) {
                      return "Variable name is already taken, please choose another.";
                    }
                  }

                  // if it does not start with a letter
                  if (!/^[a-z]/.test(value)) {
                    return "Variable name must start with a letter.";
                  }
                },
              }}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      {...field}
                      isInvalid={isNameError}
                      type="text"
                      placeholder="Field name e.g, score, price"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  {...field}
                  onValueChange={(value) => {
                    form.setValue("value", value === "number" ? 0 : "");
                    field.onChange(value);
                  }}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select type" className="text-sm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"number"}>Number</SelectItem>
                    <SelectItem value={"text"}>Text</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />

            <p className="text-slate-600">=</p>

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(variableType === "number" ? Number(e.target.value) : e.target.value);
                      }}
                      placeholder="Initial value"
                      type={variableType === "number" ? "number" : "text"}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {mode === "create" && (
              <Button variant="secondary" type="submit" className="h-10 whitespace-nowrap">
                Add variable
              </Button>
            )}

            {mode === "edit" && variable && (
              <Button
                variant="minimal"
                type="button"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => onVaribleDelete(variable)}>
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isNameError && <p className="mt-1 text-sm text-red-500">{errors.name?.message}</p>}
        </form>
      </FormProvider>
    </div>
  );
};
