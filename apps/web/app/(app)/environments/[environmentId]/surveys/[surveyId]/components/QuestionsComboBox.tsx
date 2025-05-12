"use client";

import { getLocalizedValue } from "@/lib/i18n/utils";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
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
  ContactIcon,
  EyeOff,
  GlobeIcon,
  GridIcon,
  HashIcon,
  HomeIcon,
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
import { Fragment, useRef, useState } from "react";
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

const questionIcons = {
  // questions
  [TSurveyQuestionTypeEnum.OpenText]: MessageSquareTextIcon,
  [TSurveyQuestionTypeEnum.Rating]: StarIcon,
  [TSurveyQuestionTypeEnum.CTA]: MousePointerClickIcon,
  [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: ListIcon,
  [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: Rows3Icon,
  [TSurveyQuestionTypeEnum.NPS]: NetPromoterScoreIcon,
  [TSurveyQuestionTypeEnum.Consent]: CheckIcon,
  [TSurveyQuestionTypeEnum.PictureSelection]: ImageIcon,
  [TSurveyQuestionTypeEnum.Matrix]: GridIcon,
  [TSurveyQuestionTypeEnum.Ranking]: ListOrderedIcon,
  [TSurveyQuestionTypeEnum.Address]: HomeIcon,
  [TSurveyQuestionTypeEnum.ContactInfo]: ContactIcon,

  // attributes
  [OptionsType.ATTRIBUTES]: User,

  // hidden fields
  [OptionsType.HIDDEN_FIELDS]: EyeOff,

  // meta
  device: SmartphoneIcon,
  os: AirplayIcon,
  browser: GlobeIcon,
  source: GlobeIcon,
  action: MousePointerClickIcon,

  // others
  Language: LanguagesIcon,

  // tags
  [OptionsType.TAGS]: HashIcon,
};

const getIcon = (type: string) => {
  const IconComponent = questionIcons[type];
  return IconComponent ? <IconComponent width={18} height={18} className="text-white" /> : null;
};

const SelectedCommandItem = ({ label, questionType, type }: Partial<QuestionOption>) => {
  const getIconType = () => {
    if (type) {
      if (type === OptionsType.QUESTIONS && questionType) {
        return getIcon(questionType);
      } else if (type === OptionsType.ATTRIBUTES) {
        return getIcon(OptionsType.ATTRIBUTES);
      } else if (type === OptionsType.HIDDEN_FIELDS) {
        return getIcon(OptionsType.HIDDEN_FIELDS);
      } else if ([OptionsType.META, OptionsType.OTHERS].includes(type) && label) {
        return getIcon(label);
      } else if (type === OptionsType.TAGS) {
        return getIcon(OptionsType.TAGS);
      }
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
  const [open, setOpen] = useState(false);
  const { t } = useTranslate();
  const commandRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  useClickOutside(commandRef, () => setOpen(false));

  return (
    <Command ref={commandRef} className="h-10 overflow-visible bg-transparent hover:bg-slate-50">
      <button
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
      </button>
      <div className="relative mt-2 h-full">
        {open && (
          <div className="animate-in bg-popover absolute top-0 z-50 max-h-52 w-full overflow-auto rounded-md bg-white outline-none">
            <CommandList>
              <CommandEmpty>{t("common.no_result_found")}</CommandEmpty>
              {options?.map((data) => (
                <Fragment key={data.header}>
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
                </Fragment>
              ))}
            </CommandList>
          </div>
        )}
      </div>
    </Command>
  );
};
