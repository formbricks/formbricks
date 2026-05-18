"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey, TSurveyHiddenFields } from "@formbricks/types/surveys/types";
import { validateId } from "@formbricks/types/surveys/validation";
import { cn } from "@/lib/cn";
import { extractRecallInfo } from "@/lib/utils/recall";
import { findHiddenFieldUsedInLogic, isUsedInQuota, isUsedInRecall } from "@/modules/survey/editor/lib/utils";
import { getValidateIdErrorMessage } from "@/modules/survey/editor/lib/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Tag } from "@/modules/ui/components/tag";

interface HiddenFieldsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeElementId: string | null;
  setActiveElementId: (elementId: string | null) => void;
  quotas: TSurveyQuota[];
  inSettings?: boolean;
}

export const HiddenFieldsCard = ({
  activeElementId,
  localSurvey,
  setActiveElementId,
  setLocalSurvey,
  quotas,
  inSettings = false,
}: HiddenFieldsCardProps) => {
  const open = activeElementId == "hidden";
  const [hiddenField, setHiddenField] = useState<string>("");
  const { t } = useTranslation();
  const setOpen = (open: boolean) => {
    if (open) {
      // NOSONAR typescript:S2301 // the function usage is clear
      setActiveElementId("hidden");
    } else {
      setActiveElementId(null);
    }
  };

  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const updateSurvey = (data: TSurveyHiddenFields, currentFieldId?: string) => {
    let updatedSurvey = { ...localSurvey };

    if (currentFieldId) {
      updatedSurvey.blocks = updatedSurvey.blocks.map((block) => ({
        ...block,
        elements: block.elements.map((element) => {
          const updatedElement = { ...element };
          for (const [languageCode, headline] of Object.entries(element.headline)) {
            if (headline.includes(`recall:${currentFieldId}`)) {
              const recallInfo = extractRecallInfo(headline);
              if (recallInfo) {
                updatedElement.headline[languageCode] = headline.replace(recallInfo, "");
              }
            }
          }
          return updatedElement;
        }),
      }));
    }

    setLocalSurvey({
      ...updatedSurvey,
      hiddenFields: {
        ...updatedSurvey.hiddenFields,
        ...data,
      },
    });
  };

  const handleDeleteHiddenField = (fieldId: string) => {
    const quesIdx = findHiddenFieldUsedInLogic(localSurvey, fieldId);

    if (quesIdx !== -1) {
      toast.error(
        t("workspace.surveys.edit.fieldId_is_used_in_logic_of_question_please_remove_it_from_logic_first", {
          fieldId,
          questionIndex: quesIdx + 1,
        })
      );
      return;
    }

    const recallElementIdx = isUsedInRecall(localSurvey, fieldId);
    if (recallElementIdx === -2) {
      toast.error(t("workspace.surveys.edit.hidden_field_used_in_recall_welcome", { hiddenField: fieldId }));
      return;
    }

    const totalElements = elements.length;
    if (recallElementIdx === totalElements) {
      toast.error(
        t("workspace.surveys.edit.hidden_field_used_in_recall_ending_card", { hiddenField: fieldId })
      );
      return;
    }
    if (recallElementIdx !== -1) {
      toast.error(
        t("workspace.surveys.edit.hidden_field_used_in_recall", {
          hiddenField: fieldId,
          questionIndex: recallElementIdx + 1,
        })
      );
      return;
    }

    const quotaIdx = quotas.findIndex((quota) => isUsedInQuota(quota, { hiddenFieldId: fieldId }));

    if (quotaIdx !== -1) {
      toast.error(
        t("workspace.surveys.edit.fieldId_is_used_in_quota_please_remove_it_from_quota_first", {
          fieldId,
          quotaName: quotas[quotaIdx].name,
        })
      );
      return;
    }

    const isHiddenFieldUsedInFollowUp = localSurvey.followUps
      .filter((f) => !f.deleted)
      .some((followUp) => {
        return followUp.action.properties.to === fieldId;
      });

    if (isHiddenFieldUsedInFollowUp) {
      toast.error(t("workspace.surveys.edit.follow_ups_hidden_field_error"));
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

  const content = (
    <Collapsible.CollapsibleContent
      className={inSettings ? "flex flex-col" : `flex flex-col px-4 ${open && "pb-6"}`}
      ref={parent}>
      {inSettings && <hr className="py-1 text-slate-600" />}
      <div className={cn("flex flex-wrap gap-2", inSettings ? "p-3" : "")} ref={parent}>
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
            {t("workspace.surveys.edit.no_hidden_fields_yet_add_first_one_below")}
          </p>
        )}
      </div>
      <form
        className={inSettings ? "mt-5 p-3 pt-0" : "mt-5"}
        onSubmit={(e) => {
          e.preventDefault();
          const existingElementIds = elements.map((element) => element.id);
          const existingEndingCardIds = localSurvey.endings.map((ending) => ending.id);
          const existingHiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];
          const existingVariableNames = localSurvey.variables.map((v) => v.name);
          const validateIdError = validateId(
            hiddenField,
            existingElementIds,
            existingEndingCardIds,
            existingHiddenFieldIds,
            existingVariableNames
          );

          if (validateIdError) {
            toast.error(getValidateIdErrorMessage(validateIdError, "hiddenField", t));
            return;
          }

          updateSurvey({
            fieldIds: [...(localSurvey.hiddenFields?.fieldIds || []), hiddenField],
            enabled: true,
          });
          toast.success(t("workspace.surveys.edit.hidden_field_added_successfully"));
          setHiddenField("");
        }}>
        <Label htmlFor="hiddenField">{t("common.hidden_field")}</Label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            autoFocus
            id="hiddenField"
            name="hiddenField"
            value={hiddenField}
            onChange={(e) => setHiddenField(e.target.value.trim())}
            placeholder={t("workspace.surveys.edit.type_field_id") + "..."}
          />
          <Button variant="secondary" type="submit" className="h-10 whitespace-nowrap">
            {t("workspace.surveys.edit.add_hidden_field_id")}
          </Button>
        </div>
      </form>
    </Collapsible.CollapsibleContent>
  );

  if (inSettings) {
    return (
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className={cn(
          open ? "" : "hover:bg-slate-50",
          "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
        )}>
        <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{t("common.hidden_fields")}</p>
              <p className="mt-1 text-sm text-slate-500">
                {t("workspace.surveys.edit.hidden_fields_description")}
              </p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        {content}
      </Collapsible.Root>
    );
  }

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
          </div>
        </Collapsible.CollapsibleTrigger>
        {content}
      </Collapsible.Root>
    </div>
  );
};
