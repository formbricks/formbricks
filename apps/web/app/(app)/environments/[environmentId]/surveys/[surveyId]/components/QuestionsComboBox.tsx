"use client";

import clsx from "clsx";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  ContactIcon,
  EyeOff,
  FlagIcon,
  GlobeIcon,
  GridIcon,
  HashIcon,
  HomeIcon,
  ImageIcon,
  LanguagesIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PieChartIcon,
  Rows3Icon,
  SmartphoneIcon,
  StarIcon,
  User,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { NetPromoterScoreIcon } from "@/modules/ui/components/icons";

export enum OptionsType {
  QUESTIONS = "Questions",
  TAGS = "Tags",
  ATTRIBUTES = "Attributes",
  OTHERS = "Other Filters",
  META = "Meta",
  HIDDEN_FIELDS = "Hidden Fields",
  QUOTAS = "Quotas",
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
  source: ArrowUpFromDotIcon,
  action: MousePointerClickIcon,
  country: FlagIcon,
  url: LinkIcon,

  // others
  Language: LanguagesIcon,

  // tags
  [OptionsType.TAGS]: HashIcon,

  // quotas
  [OptionsType.QUOTAS]: PieChartIcon,
};

const getIcon = (type: string) => {
  const IconComponent = questionIcons[type];
  return IconComponent ? <IconComponent className="h-5 w-5" strokeWidth={1.5} /> : null;
};

const getIconBackground = (type: OptionsType | string): string => {
  const backgroundMap: Record<string, string> = {
    [OptionsType.ATTRIBUTES]: "bg-indigo-500",
    [OptionsType.QUESTIONS]: "bg-brand-dark",
    [OptionsType.TAGS]: "bg-indigo-500",
    [OptionsType.QUOTAS]: "bg-slate-500",
  };
  return backgroundMap[type] ?? "bg-amber-500";
};

const getLabelClassName = (type: OptionsType | string, label?: string): string => {
  if (type !== OptionsType.META) return "";
  return label === "os" || label === "url" ? "uppercase" : "capitalize";
};

export const SelectedCommandItem = ({ label, questionType, type }: Partial<QuestionOption>) => {
  const getDisplayIcon = () => {
    if (!type) return null;
    if (type === OptionsType.QUESTIONS && questionType) return getIcon(questionType);
    if (type === OptionsType.ATTRIBUTES) return getIcon(OptionsType.ATTRIBUTES);
    if (type === OptionsType.HIDDEN_FIELDS) return getIcon(OptionsType.HIDDEN_FIELDS);
    if ([OptionsType.META, OptionsType.OTHERS].includes(type) && label) return getIcon(label);
    if (type === OptionsType.TAGS) return getIcon(OptionsType.TAGS);
    if (type === OptionsType.QUOTAS) return getIcon(OptionsType.QUOTAS);
    return null;
  };

  return (
    <div className="flex h-full min-w-0 items-center gap-2">
      <span
        className={clsx(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-white",
          getIconBackground(type ?? "")
        )}>
        {getDisplayIcon()}
      </span>
      <p className={clsx("truncate text-sm text-slate-600", getLabelClassName(type ?? "", label))}>
        {typeof label === "string" ? label : getLocalizedValue(label, "default")}
      </p>
    </div>
  );
};

export const QuestionsComboBox = ({ options, selected, onChangeValue }: QuestionComboBoxProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const commandRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  useClickOutside(commandRef, () => setOpen(false));

  const hasSelection = selected.hasOwnProperty("label");
  const ChevronIcon = open ? ChevronUp : ChevronDown;

  return (
    <Command
      ref={commandRef}
      className="relative h-fit w-full overflow-visible rounded-md border border-slate-300 bg-white hover:border-slate-400">
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-center justify-between"
        onClick={() => !open && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            !open && setOpen(true);
          }
        }}>
        {!open && hasSelection && <SelectedCommandItem {...selected} />}
        {(open || !hasSelection) && (
          <CommandInput
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={open ? `${t("common.search")}...` : t("common.select_filter")}
            className="max-w-full grow border-none p-0 pl-2 text-sm shadow-none outline-none ring-offset-transparent focus:border-none focus:shadow-none focus:outline-none focus:ring-offset-0"
          />
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          variant="secondary"
          size="icon"
          className="flex-shrink-0"
          aria-expanded={open}
          aria-label={t("common.select")}>
          <ChevronIcon className="h-4 w-4 opacity-50" />
        </Button>
      </div>

      {open && (
        <div className="animate-in absolute top-full z-10 mt-1 w-full overflow-auto rounded-md shadow-md outline-none">
          <CommandList className="max-h-[600px]">
            <CommandEmpty>{t("common.no_result_found")}</CommandEmpty>
            {options?.map((data) => (
              <Fragment key={data.header}>
                {data?.option.length > 0 && (
                  <CommandGroup heading={<p className="text-sm font-medium text-slate-600">{data.header}</p>}>
                    {data?.option?.map((o) => (
                      <CommandItem
                        key={o.id}
                        onSelect={() => {
                          setInputValue("");
                          onChangeValue(o);
                          setOpen(false);
                        }}>
                        <SelectedCommandItem {...o} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </Fragment>
            ))}
          </CommandList>
        </div>
      )}
    </Command>
  );
};
