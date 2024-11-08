"use client";

import { findHiddenFieldUsedInLogic } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyHiddenFields, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { validateId } from "@formbricks/types/surveys/validation";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";
import { Tag } from "@formbricks/ui/components/Tag";

interface HiddenFieldsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
}

export const HiddenFieldsCard = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}: HiddenFieldsCardProps) => {
  const open = activeQuestionId == "hidden";
  const [hiddenField, setHiddenField] = useState<string>("");
  const t = useTranslations();
  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("hidden");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data: TSurveyHiddenFields, currentFieldId?: string) => {
    const questions = [...localSurvey.questions];

    // Remove recall info from question headlines
    if (currentFieldId) {
      questions.forEach((question) => {
        for (const [languageCode, headline] of Object.entries(question.headline)) {
          if (headline.includes(`recall:${currentFieldId}`)) {
            const recallInfo = extractRecallInfo(headline);
            if (recallInfo) {
              question.headline[languageCode] = headline.replace(recallInfo, "");
            }
          }
        }
      });
    }

    setLocalSurvey({
      ...localSurvey,
      questions,
      hiddenFields: {
        ...localSurvey.hiddenFields,
        ...data,
      },
    });
  };

  const handleDeleteHiddenField = (fieldId: string) => {
    const quesIdx = findHiddenFieldUsedInLogic(localSurvey, fieldId);

    if (quesIdx !== -1) {
      toast.error(
        t(
          "environments.surveys.edit.fieldId_is_used_in_logic_of_question_please_remove_it_from_logic_first",
          {
            fieldId,
            questionIndex: quesIdx + 1,
          }
        )
      );
      return;
    }

    updateSurvey(
      {
        enabled: true,
        fieldIds: localSurvey.hiddenFields?.fieldIds?.filter((q) => q !== fieldId),
      },
      fieldId
    );
  };

  // Auto Animate
  const [parent] = useAutoAnimate();

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
        )}>
        <EyeOff className="h-4 w-4" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">{t("common.hidden_fields")}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="hidden-fields-toggle">
                {localSurvey?.hiddenFields?.enabled ? t("common.on") : t("common.off")}
              </Label>

              <Switch
                id="hidden-fields-toggle"
                checked={localSurvey?.hiddenFields?.enabled}
                onClick={(e) => {
                  e.stopPropagation();
                  updateSurvey({ enabled: !localSurvey.hiddenFields?.enabled });
                }}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-6"}`} ref={parent}>
          <div className="flex flex-wrap gap-2" ref={parent}>
            {localSurvey.hiddenFields?.fieldIds && localSurvey.hiddenFields?.fieldIds?.length > 0 ? (
              localSurvey.hiddenFields?.fieldIds?.map((fieldId) => {
                return (
                  <Tag
                    key={fieldId}
                    onDelete={(fieldId) => handleDeleteHiddenField(fieldId)}
                    tagId={fieldId}
                    tagName={fieldId}
                  />
                );
              })
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">
                {t("environments.surveys.edit.no_hidden_fields_yet_add_first_one_below")}
              </p>
            )}
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const existingQuestionIds = localSurvey.questions.map((question) => question.id);
              const existingEndingCardIds = localSurvey.endings.map((ending) => ending.id);
              const existingHiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];
              const validateIdError = validateId(
                "Hidden field",
                hiddenField,
                existingQuestionIds,
                existingEndingCardIds,
                existingHiddenFieldIds
              );

              if (validateIdError) {
                toast.error(validateIdError);
                return;
              }

              updateSurvey({
                fieldIds: [...(localSurvey.hiddenFields?.fieldIds || []), hiddenField],
                enabled: true,
              });
              toast.success(t("environments.surveys.edit.hidden_field_added_successfully"));
              setHiddenField("");
            }}>
            <Label htmlFor="headline">{t("common.hidden_field")}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                autoFocus
                id="headline"
                name="headline"
                value={hiddenField}
                onChange={(e) => setHiddenField(e.target.value.trim())}
                placeholder={t("environments.surveys.edit.type_field_id") + "..."}
              />
              <Button variant="secondary" type="submit" size="sm" className="whitespace-nowrap">
                {t("environments.surveys.edit.add_hidden_field_id")}
              </Button>
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
