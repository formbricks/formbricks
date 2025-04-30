"use client";

import { extractRecallInfo } from "@/lib/utils/recall";
import { findVariableUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";

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
  // [UseTusk]

  const { t } = useTranslate();
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

  const onVariableDelete = (variable: TSurveyVariable) => {
    const questions = [...localSurvey.questions];

    const quesIdx = findVariableUsedInLogic(localSurvey, variable.id);

    if (quesIdx !== -1) {
      toast.error(
        t(
          "environments.surveys.edit.variable_is_used_in_logic_of_question_please_remove_it_from_logic_first",
          {
            variable: variable.name,
            questionIndex: quesIdx + 1,
          }
        )
      );
      return;
    }

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
          {mode === "create" && (
            <Label htmlFor="headline">{t("environments.surveys.edit.add_variable")}</Label>
          )}

          <div className="mt-2 flex w-full items-center gap-2">
            <FormField
              control={form.control}
              name="name"
              rules={{
                pattern: {
                  value: /^[a-z0-9_]+$/,
                  message: t(
                    "environments.surveys.edit.only_lower_case_letters_numbers_and_underscores_are_allowed"
                  ),
                },
                validate: (value) => {
                  // if the variable name is already taken
                  if (
                    mode === "create" &&
                    localSurvey.variables.find((variable) => variable.name === value)
                  ) {
                    return t(
                      "environments.surveys.edit.variable_name_is_already_taken_please_choose_another"
                    );
                  }

                  if (mode === "edit" && variable && variable.name !== value) {
                    if (localSurvey.variables.find((variable) => variable.name === value)) {
                      return t(
                        "environments.surveys.edit.variable_name_is_already_taken_please_choose_another"
                      );
                    }
                  }

                  // if it does not start with a letter
                  if (!/^[a-z]/.test(value)) {
                    return t("environments.surveys.edit.variable_name_must_start_with_a_letter");
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
                      placeholder={t("environments.surveys.edit.field_name_eg_score_price")}
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
                    <SelectValue
                      placeholder={t("environments.surveys.edit.select_type")}
                      className="text-sm"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"number"}>{t("common.number")}</SelectItem>
                    <SelectItem value={"text"}>{t("common.text")}</SelectItem>
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
                      placeholder={t("environments.surveys.edit.initial_value")}
                      type={variableType === "number" ? "number" : "text"}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {mode === "create" && (
              <Button variant="secondary" type="submit" className="h-10 whitespace-nowrap">
                {t("environments.surveys.edit.add_variable")}
              </Button>
            )}

            {mode === "edit" && variable && (
              <Button
                variant="ghost"
                type="button"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => onVariableDelete(variable)}>
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
