"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { NetPromoterScoreIcon } from "@/modules/ui/components/icons";
import { useTranslate } from "@tolgee/react";
import clsx from "clsx";
import {
  AirplayIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  EyeOff,
  GlobeIcon,
  GridIcon,
  HashIcon,
  HelpCircleIcon,
  ImageIcon,
  LanguagesIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  Rows3Icon,
  SmartphoneIcon,
  StarIcon,
  User,
} from "lucide-react";
import * as React from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export enum OptionsType {
  QUESTIONS = "Questions",
  TAGS = "Tags",
  ATTRIBUTES = "Attributes",
  OTHERS = "Other Filters",
  META = "Meta",
  HIDDEN_FIELDS = "Hidden Fields",
}

export type QuestionOption = {
  label: string;
  questionType?: TSurveyQuestionTypeEnum;
  type: OptionsType;
  id: string;
};
export type QuestionOptions = {
  header: OptionsType;
  option: QuestionOption[];
};

interface QuestionComboBoxProps {
  options: QuestionOptions[];
  selected: Partial<QuestionOption>;
  onChangeValue: (option: QuestionOption) => void;
}

const SelectedCommandItem = ({ label, questionType, type }: Partial<QuestionOption>) => {
  const getIconType = () => {
    switch (type) {
      case OptionsType.QUESTIONS:
        switch (questionType) {
          case TSurveyQuestionTypeEnum.OpenText:
            return <MessageSquareTextIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.Rating:
            return <StarIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.CTA:
            return <MousePointerClickIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.OpenText:
            return <HelpCircleIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.MultipleChoiceMulti:
            return <ListIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
            return <Rows3Icon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.NPS:
            return <NetPromoterScoreIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.Consent:
            return <CheckIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.PictureSelection:
            return <ImageIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.Matrix:
            return <GridIcon width={18} height={18} className="text-white" />;
          case TSurveyQuestionTypeEnum.Ranking:
            return <ListOrderedIcon width={18} height={18} className="text-white" />;
        }
      case OptionsType.ATTRIBUTES:
        return <User width={18} height={18} className="text-white" />;

      case OptionsType.HIDDEN_FIELDS:
        return <EyeOff width={18} height={18} className="text-white" />;
      case OptionsType.META:
        switch (label) {
          case "device":
            return <SmartphoneIcon width={18} height={18} className="text-white" />;
          case "os":
            return <AirplayIcon width={18} height={18} className="text-white" />;
          case "browser":
            return <GlobeIcon width={18} height={18} className="text-white" />;
          case "source":
            return <GlobeIcon width={18} height={18} className="text-white" />;
          case "action":
            return <MousePointerClickIcon width={18} height={18} className="text-white" />;
        }
      case OptionsType.OTHERS:
        switch (label) {
          case "Language":
            return <LanguagesIcon width={18} height={18} className="text-white" />;
        }
      case OptionsType.TAGS:
        return <HashIcon width={18} height={18} className="text-white" />;
    }
  };

  const getColor = () => {
    if (type === OptionsType.ATTRIBUTES) {
      return "bg-indigo-500";
    } else if (type === OptionsType.QUESTIONS) {
      return "bg-brand-dark";
    } else if (type === OptionsType.TAGS) {
      return "bg-indigo-500";
    } else {
      return "bg-amber-500";
    }
  };
  return (
    <div className="flex h-5 w-[12rem] items-center sm:w-4/5">
      <span className={clsx("rounded-md p-1", getColor())}>{getIconType()}</span>
      <p className="ml-3 truncate text-sm text-slate-600">
        {typeof label === "string" ? label : getLocalizedValue(label, "default")}
      </p>
    </div>
  );
};

export const QuestionsComboBox = ({ options, selected, onChangeValue }: QuestionComboBoxProps) => {
  const [open, setOpen] = React.useState(false);
  const { t } = useTranslate();
  const commandRef = React.useRef(null);
  const [inputValue, setInputValue] = React.useState("");
  useClickOutside(commandRef, () => setOpen(false));

  return (
    <Command ref={commandRef} className="h-10 overflow-visible bg-transparent hover:bg-slate-50">
      <div
        onClick={() => setOpen(true)}
        className="group flex cursor-pointer items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
        {!open && selected.hasOwnProperty("label") && (
          <SelectedCommandItem
            label={selected?.label}
            type={selected?.type}
            questionType={selected?.questionType}
          />
        )}
        {(open || !selected.hasOwnProperty("label")) && (
          <CommandInput
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={t("common.search") + "..."}
            className="h-5 border-none border-transparent p-0 shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
          />
        )}
        <div>
          {open ? (
            <ChevronUp className="ml-2 h-4 w-4 opacity-50" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </div>
      </div>
      <div className="relative mt-2 h-full">
        {open && (
          <div className="animate-in bg-popover absolute top-0 z-50 max-h-52 w-full overflow-auto rounded-md bg-white outline-none">
            <CommandList>
              <CommandEmpty>{t("common.no_result_found")}</CommandEmpty>
              {options?.map((data) => (
                <>
                  {data?.option.length > 0 && (
                    <CommandGroup
                      heading={<p className="text-sm font-normal text-slate-600">{data.header}</p>}>
                      {data?.option?.map((o, i) => (
                        <CommandItem
                          key={`${o.label}-${i}`}
                          onSelect={() => {
                            setInputValue("");
                            onChangeValue(o);
                            setOpen(false);
                          }}
                          className="cursor-pointer">
                          <SelectedCommandItem label={o.label} type={o.type} questionType={o.questionType} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              ))}
            </CommandList>
          </div>
        )}
      </div>
    </Command>
  );
};
