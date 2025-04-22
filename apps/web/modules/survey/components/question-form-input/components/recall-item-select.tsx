import { replaceRecallInfoWithUnderline } from "@/lib/utils/recall";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import {
  CalendarDaysIcon,
  ContactIcon,
  EyeOffIcon,
  FileDigitIcon,
  FileTextIcon,
  HomeIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  TSurvey,
  TSurveyHiddenFields,
  TSurveyQuestion,
  TSurveyQuestionId,
  TSurveyRecallItem,
} from "@formbricks/types/surveys/types";

const questionIconMapping = {
  openText: MessageSquareTextIcon,
  multipleChoiceSingle: Rows3Icon,
  multipleChoiceMulti: ListIcon,
  rating: StarIcon,
  nps: PresentationIcon,
  date: CalendarDaysIcon,
  cal: PhoneIcon,
  address: HomeIcon,
  contactInfo: ContactIcon,
  ranking: ListOrderedIcon,
};

interface RecallItemSelectProps {
  localSurvey: TSurvey;
  questionId: TSurveyQuestionId;
  addRecallItem: (question: TSurveyRecallItem) => void;
  setShowRecallItemSelect: (show: boolean) => void;
  recallItems: TSurveyRecallItem[];
  selectedLanguageCode: string;
  hiddenFields: TSurveyHiddenFields;
}

export const RecallItemSelect = ({
  localSurvey,
  questionId,
  addRecallItem,
  setShowRecallItemSelect,
  recallItems,
  selectedLanguageCode,
}: RecallItemSelectProps) => {
  const [searchValue, setSearchValue] = useState("");
  const isNotAllowedQuestionType = (question: TSurveyQuestion): boolean => {
    return (
      question.type === "fileUpload" ||
      question.type === "cta" ||
      question.type === "consent" ||
      question.type === "pictureSelection" ||
      question.type === "cal" ||
      question.type === "matrix"
    );
  };

  const recallItemIds = useMemo(() => {
    return recallItems.map((recallItem) => recallItem.id);
  }, [recallItems]);

  const hiddenFieldRecallItems = useMemo(() => {
    if (localSurvey.hiddenFields.fieldIds) {
      return localSurvey.hiddenFields.fieldIds
        .filter((hiddenFieldId) => {
          return !recallItemIds.includes(hiddenFieldId);
        })
        .map((hiddenFieldId) => ({
          id: hiddenFieldId,
          label: hiddenFieldId,
          type: "hiddenField" as const,
        }));
    }
    return [];
  }, [localSurvey.hiddenFields, recallItemIds]);

  const variableRecallItems = useMemo(() => {
    if (localSurvey.variables.length) {
      return localSurvey.variables
        .filter((variable) => !recallItemIds.includes(variable.id))
        .map((variable) => {
          return {
            id: variable.id,
            label: variable.name,
            type: "variable" as const,
          };
        });
    }

    return [];
  }, [localSurvey.variables, recallItemIds]);

  const surveyQuestionRecallItems = useMemo(() => {
    const isEndingCard = !localSurvey.questions.map((question) => question.id).includes(questionId);
    const idx = isEndingCard
      ? localSurvey.questions.length
      : localSurvey.questions.findIndex((recallQuestion) => recallQuestion.id === questionId);
    const filteredQuestions = localSurvey.questions
      .filter((question, index) => {
        const notAllowed = isNotAllowedQuestionType(question);
        return (
          !recallItemIds.includes(question.id) && !notAllowed && question.id !== questionId && idx > index
        );
      })
      .map((question) => {
        return { id: question.id, label: question.headline[selectedLanguageCode], type: "question" as const };
      });

    return filteredQuestions;
  }, [localSurvey.questions, questionId, recallItemIds]);

  const filteredRecallItems: TSurveyRecallItem[] = useMemo(() => {
    return [...surveyQuestionRecallItems, ...hiddenFieldRecallItems, ...variableRecallItems].filter(
      (recallItems) => {
        if (searchValue.trim() === "") return true;
        else {
          return recallItems.label.toLowerCase().startsWith(searchValue.toLowerCase());
        }
      }
    );
  }, [surveyQuestionRecallItems, hiddenFieldRecallItems, variableRecallItems, searchValue]);

  // function to modify headline (recallInfo to corresponding headline)
  const getRecallLabel = (label: string): string => {
    return replaceRecallInfoWithUnderline(label);
  };

  const getRecallItemIcon = (recallItem: TSurveyRecallItem) => {
    switch (recallItem.type) {
      case "question":
        const question = localSurvey.questions.find((question) => question.id === recallItem.id);
        if (question) {
          return questionIconMapping[question?.type as keyof typeof questionIconMapping];
        }
      case "hiddenField":
        return EyeOffIcon;
      case "variable":
        const variable = localSurvey.variables.find((variable) => variable.id === recallItem.id);
        return variable?.type === "number" ? FileDigitIcon : FileTextIcon;
    }
  };

  return (
    <>
      <DropdownMenu defaultOpen={true} modal={false}>
        <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
          <div className="flex h-0 w-full items-center justify-between overflow-hidden" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-96 bg-slate-50 text-slate-700" align="start" side="bottom">
          <p className="m-2 text-sm font-medium">Recall Information from...</p>
          <Input
            id="recallItemSearchInput"
            placeholder="Search options"
            className="mb-1 w-full bg-white"
            onChange={(e) => setSearchValue(e.target.value)}
            autoFocus={true}
            value={searchValue}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                document.getElementById("recallItem-0")?.focus();
              }
            }}
          />
          <div className="max-h-72 overflow-x-hidden overflow-y-auto">
            {filteredRecallItems.map((recallItem, index) => {
              const IconComponent = getRecallItemIcon(recallItem);
              return (
                <DropdownMenuItem
                  id={"recallItem-" + index}
                  key={recallItem.id}
                  title={recallItem.label}
                  onSelect={() => {
                    addRecallItem({ id: recallItem.id, label: recallItem.label, type: recallItem.type });
                    setShowRecallItemSelect(false);
                  }}
                  autoFocus={false}
                  className="flex w-full cursor-pointer items-center rounded-md p-2 focus:bg-slate-200 focus:outline-hidden"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && index === 0) {
                      document.getElementById("recallItemSearchInput")?.focus();
                    } else if (e.key === "ArrowDown" && index === filteredRecallItems.length - 1) {
                      document.getElementById("recallItemSearchInput")?.focus();
                    }
                  }}>
                  <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
                  <p className="max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                    {getRecallLabel(recallItem.label)}
                  </p>
                </DropdownMenuItem>
              );
            })}
            {filteredRecallItems.length === 0 && (
              <p className="p-2 text-sm font-medium text-slate-700">No recall items found 🤷</p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
