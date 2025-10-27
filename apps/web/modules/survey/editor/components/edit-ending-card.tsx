"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { GripIcon, Handshake, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyQuestionId,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { recallToHeadline } from "@/lib/utils/recall";
import { EditorCardMenu } from "@/modules/survey/editor/components/editor-card-menu";
import { EndScreenForm } from "@/modules/survey/editor/components/end-screen-form";
import { RedirectUrlForm } from "@/modules/survey/editor/components/redirect-url-form";
import {
  findEndingCardUsedInLogic,
  formatTextWithSlashes,
  isUsedInQuota,
} from "@/modules/survey/editor/lib/utils";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface EditEndingCardProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId: TSurveyQuestionId | null;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  addEndingCard: (index: number) => void;
  isFormbricksCloud: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  quotas: TSurveyQuota[];
  isExternalUrlsAllowed: boolean;
}

export const EditEndingCard = ({
  localSurvey,
  endingCardIndex,
  setLocalSurvey,
  setActiveQuestionId,
  activeQuestionId,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  addEndingCard,
  isFormbricksCloud,
  locale,
  isStorageConfigured,
  quotas,
  isExternalUrlsAllowed,
}: EditEndingCardProps) => {
  const { t } = useTranslation();

  const endingCard = useMemo(
    () => localSurvey.endings[endingCardIndex],
    [localSurvey.endings, endingCardIndex]
  );

  const isRedirectToUrlDisabled = isFormbricksCloud
    ? !isExternalUrlsAllowed && endingCard.type !== "redirectToUrl"
    : false;

  const [openDeleteConfirmationModal, setOpenDeleteConfirmationModal] = useState(false);

  const endingCardTypes = [
    { value: "endScreen", label: t("environments.surveys.edit.ending_card") },
    {
      value: "redirectToUrl",
      label: t("environments.surveys.edit.redirect_to_url"),
      disabled: isRedirectToUrlDisabled,
    },
  ];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: endingCard.id,
  });

  let open = activeQuestionId === endingCard.id;

  const setOpen = (e) => {
    if (e) {
      setActiveQuestionId(endingCard.id);
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (
    data: Partial<TSurveyEndScreenCard & { _forceUpdate?: boolean }> | Partial<TSurveyRedirectUrlCard>
  ) => {
    setLocalSurvey((prevSurvey) => {
      const currentEnding = prevSurvey.endings[endingCardIndex];

      // If subheader was explicitly deleted (is undefined) in the current state,
      // block ALL attempts to recreate it (from Editor cleanup/updates)
      // UNLESS it's a forced update from the "Add Description" button
      const filteredData = { ...data };
      const isForceUpdate = "_forceUpdate" in filteredData;
      if (isForceUpdate) {
        delete (filteredData as any)._forceUpdate; // Remove the flag
      }

      if (!isForceUpdate && currentEnding?.type === "endScreen" && currentEnding.subheader === undefined) {
        if ("subheader" in filteredData) {
          // Block subheader updates when it's been deleted (Editor cleanup trying to recreate)
          delete filteredData.subheader;
        }
      }

      const updatedEndings = prevSurvey.endings.map((ending, idx) =>
        idx === endingCardIndex ? { ...ending, ...filteredData } : ending
      );
      return { ...prevSurvey, endings: updatedEndings };
    });
  };

  const deleteEndingCard = () => {
    const quotaIdx = quotas.findIndex((quota) => isUsedInQuota(quota, { endingCardId: endingCard.id }));
    if (quotaIdx !== -1) {
      toast.error(
        t("environments.surveys.edit.ending_used_in_quota", {
          quotaName: quotas[quotaIdx].name,
        })
      );
      return;
    }
    const isEndingCardUsedInFollowUps = localSurvey.followUps.some((followUp) => {
      if (followUp.trigger.type === "endings") {
        if (followUp.trigger.properties?.endingIds?.includes(endingCard.id)) {
          return true;
        }
      }

      return false;
    });

    // checking if this ending card is used in logic
    const quesIdx = findEndingCardUsedInLogic(localSurvey, endingCard.id);

    if (quesIdx !== -1) {
      toast.error(t("environments.surveys.edit.ending_card_used_in_logic", { questionIndex: quesIdx + 1 }));
      return;
    }

    if (isEndingCardUsedInFollowUps) {
      setOpenDeleteConfirmationModal(true);
      return;
    }

    setLocalSurvey((prevSurvey) => {
      const updatedEndings = prevSurvey.endings.filter((_, index) => index !== endingCardIndex);
      return { ...prevSurvey, endings: updatedEndings };
    });
  };

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  const duplicateEndingCard = () => {
    setLocalSurvey((prevSurvey) => {
      const endingToDuplicate = prevSurvey.endings[endingCardIndex];
      const duplicatedEndingCard = {
        ...endingToDuplicate,
        id: createId(),
      };
      const updatedEndings = [
        ...prevSurvey.endings.slice(0, endingCardIndex + 1),
        duplicatedEndingCard,
        ...prevSurvey.endings.slice(endingCardIndex + 1),
      ];
      return { ...prevSurvey, endings: updatedEndings };
    });
  };

  const moveEndingCard = (index: number, up: boolean) => {
    setLocalSurvey((prevSurvey) => {
      const newEndings = [...prevSurvey.endings];
      const [movedEnding] = newEndings.splice(index, 1);
      newEndings.splice(up ? index - 1 : index + 1, 0, movedEnding);
      return { ...prevSurvey, endings: newEndings };
    });
  };

  return (
    <div
      className={cn(open ? "shadow-lg" : "shadow-md", "group z-20 flex flex-row rounded-lg bg-white")}
      ref={setNodeRef}
      style={style}
      id={endingCard.id}>
      <div
        {...listeners}
        {...attributes}
        className={cn(
          open ? "bg-slate-50" : "",
          "flex w-10 flex-col items-center justify-between rounded-l-lg border-b border-l border-t py-2 group-aria-expanded:rounded-bl-none",
          isInvalid ? "bg-red-400" : "bg-white group-hover:bg-slate-50"
        )}>
        <div className="mt-3 flex w-full justify-center">
          {endingCard.type === "endScreen" ? (
            <Handshake className="h-4 w-4" />
          ) : (
            <Undo2 className="h-4 w-4 rotate-180" />
          )}
        </div>
        <button className="opacity-0 transition-all duration-300 hover:cursor-move group-hover:opacity-100">
          <GripIcon className="h-4 w-4" />
        </button>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-5 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">
                  {endingCard.type === "endScreen" &&
                    (endingCard.headline &&
                    recallToHeadline(endingCard.headline, localSurvey, true, selectedLanguageCode)[
                      selectedLanguageCode
                    ]
                      ? formatTextWithSlashes(
                          getTextContent(
                            recallToHeadline(endingCard.headline, localSurvey, true, selectedLanguageCode)[
                              selectedLanguageCode
                            ]
                          )
                        )
                      : t("environments.surveys.edit.ending_card"))}
                  {endingCard.type === "redirectToUrl" &&
                    (endingCard.label || t("environments.surveys.edit.redirect_to_url"))}
                </p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {endingCard.type === "endScreen"
                      ? t("environments.surveys.edit.ending_card")
                      : t("environments.surveys.edit.redirect_to_url")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <EditorCardMenu
                survey={localSurvey}
                cardIdx={endingCardIndex}
                lastCard={endingCardIndex === localSurvey.endings.length - 1}
                duplicateCard={duplicateEndingCard}
                deleteCard={deleteEndingCard}
                moveCard={moveEndingCard}
                card={endingCard}
                updateCard={() => {}}
                addCard={addEndingCard}
                cardType="ending"
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "mt-3 pb-6"}`}>
          <TooltipRenderer
            shouldRender={endingCard.type === "endScreen" && isRedirectToUrlDisabled}
            tooltipContent={t("environments.surveys.edit.external_urls_paywall_tooltip")}
            triggerClass="w-full">
            <OptionsSwitch
              options={endingCardTypes}
              currentOption={endingCard.type}
              handleOptionChange={(newType) => {
                const selectedOption = endingCardTypes.find((option) => option.value === newType);
                if (!selectedOption?.disabled) {
                  if (newType === "redirectToUrl") {
                    updateSurvey({ type: "redirectToUrl" });
                  } else {
                    updateSurvey({ type: "endScreen" });
                  }
                }
              }}
            />
          </TooltipRenderer>
          {endingCard.type === "endScreen" && (
            <EndScreenForm
              localSurvey={localSurvey}
              endingCardIndex={endingCardIndex}
              isInvalid={isInvalid}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              updateSurvey={updateSurvey}
              endingCard={endingCard}
              locale={locale}
              isStorageConfigured={isStorageConfigured}
              isExternalUrlsAllowed={isExternalUrlsAllowed}
            />
          )}
          {endingCard.type === "redirectToUrl" && (
            <RedirectUrlForm localSurvey={localSurvey} endingCard={endingCard} updateSurvey={updateSurvey} />
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>

      <ConfirmationModal
        buttonText={t("common.delete")}
        onConfirm={() => {
          setLocalSurvey((prevSurvey) => {
            const updatedEndings = prevSurvey.endings.filter((_, index) => index !== endingCardIndex);
            const surveyFollowUps = prevSurvey.followUps.map((f) => {
              if (f.trigger.properties?.endingIds?.includes(endingCard.id)) {
                return {
                  ...f,
                  trigger: {
                    ...f.trigger,
                    properties: {
                      ...f.trigger.properties,
                      endingIds: f.trigger.properties.endingIds.filter((id) => id !== endingCard.id),
                    },
                  },
                };
              }

              return f;
            });

            return { ...prevSurvey, endings: updatedEndings, followUps: surveyFollowUps };
          });
        }}
        open={openDeleteConfirmationModal}
        setOpen={setOpenDeleteConfirmationModal}
        body={t("environments.surveys.edit.follow_ups_ending_card_delete_modal_text")}
        title={t("environments.surveys.edit.follow_ups_ending_card_delete_modal_title")}
      />
    </div>
  );
};
