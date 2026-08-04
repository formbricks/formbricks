"use client";

import clsx from "clsx";
import { TFunction } from "i18next";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  ContactIcon,
  EyeOff,
  FlagIcon,
  GaugeIcon,
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
  NetworkIcon,
  PieChartIcon,
  Rows3Icon,
  SmartphoneIcon,
  SmilePlusIcon,
  StarIcon,
  User,
} from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
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
  ELEMENTS = "Elements",
  TAGS = "Tags",
  ATTRIBUTES = "Attributes",
  OTHERS = "Other Filters",
  META = "Meta",
  HIDDEN_FIELDS = "Hidden Fields",
  QUOTAS = "Quotas",
}

const getOptionsTypeTranslationKey = (type: OptionsType, t: TFunction): string => {
  switch (type) {
    case OptionsType.ELEMENTS:
      return t("common.elements");
    case OptionsType.TAGS:
      return t("common.tags");
    case OptionsType.ATTRIBUTES:
      return t("common.attributes");
    case OptionsType.OTHERS:
      return t("common.other_filters");
    case OptionsType.META:
      return t("common.meta");
    case OptionsType.HIDDEN_FIELDS:
      return t("common.hidden_fields");
    case OptionsType.QUOTAS:
      return t("common.quotas");
  }
};

export type ElementOption = {
  label: string;
  elementType?: TSurveyElementTypeEnum;
  type: OptionsType;
  id: string;
};
export type ElementOptions = {
  header: OptionsType;
  option: ElementOption[];
};

interface ElementComboBoxProps {
  options: ElementOptions[];
  selected: Partial<ElementOption>;
  onChangeValue: (option: ElementOption) => void;
}

const elementIcons = {
  // elements
  [TSurveyElementTypeEnum.OpenText]: MessageSquareTextIcon,
  [TSurveyElementTypeEnum.Rating]: StarIcon,
  [TSurveyElementTypeEnum.CTA]: MousePointerClickIcon,
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: ListIcon,
  [TSurveyElementTypeEnum.MultipleChoiceSingle]: Rows3Icon,
  [TSurveyElementTypeEnum.NPS]: NetPromoterScoreIcon,
  [TSurveyElementTypeEnum.Consent]: CheckIcon,
  [TSurveyElementTypeEnum.PictureSelection]: ImageIcon,
  [TSurveyElementTypeEnum.Matrix]: GridIcon,
  [TSurveyElementTypeEnum.Ranking]: ListOrderedIcon,
  [TSurveyElementTypeEnum.CSAT]: SmilePlusIcon,
  [TSurveyElementTypeEnum.CES]: GaugeIcon,
  [TSurveyElementTypeEnum.Address]: HomeIcon,
  [TSurveyElementTypeEnum.ContactInfo]: ContactIcon,

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
  ipAddress: NetworkIcon,

  // others
  Language: LanguagesIcon,

  // tags
  [OptionsType.TAGS]: HashIcon,

  // quotas
  [OptionsType.QUOTAS]: PieChartIcon,
};

const getIcon = (type: string) => {
  const IconComponent = (elementIcons as Record<string, (typeof elementIcons)[keyof typeof elementIcons]>)[
    type
  ];
  return IconComponent ? <IconComponent className="size-5" strokeWidth={1.5} /> : null;
};

const getIconBackground = (type: OptionsType | string): string => {
  const backgroundMap: Record<string, string> = {
    [OptionsType.ATTRIBUTES]: "bg-indigo-500",
    [OptionsType.ELEMENTS]: "bg-brand-dark",
    [OptionsType.TAGS]: "bg-indigo-500",
    [OptionsType.QUOTAS]: "bg-slate-500",
  };
  return backgroundMap[type] ?? "bg-amber-500";
};

const getLabelClassName = (type: OptionsType | string, label?: string): string => {
  if (type !== OptionsType.META) return "";
  return label === "os" || label === "url" ? "uppercase" : "capitalize";
};

export const SelectedCommandItem = ({ label, elementType, type }: Partial<ElementOption>) => {
  const getDisplayIcon = () => {
    if (!type) return null;
    if (type === OptionsType.ELEMENTS && elementType) return getIcon(elementType);
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white",
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

export const ElementsComboBox = ({ options, selected, onChangeValue }: ElementComboBoxProps) => {
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
            className="max-w-full grow border-none p-0 pl-2 text-sm shadow-none ring-offset-transparent outline-hidden focus:border-none focus:shadow-none focus:ring-offset-0 focus:outline-hidden"
          />
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          variant="secondary"
          size="icon"
          className="shrink-0"
          aria-expanded={open}
          aria-label={t("common.select")}>
          <ChevronIcon className="size-4 opacity-50" />
        </Button>
      </div>

      {open && (
        <div className="absolute top-full z-10 mt-1 w-full overflow-auto rounded-md shadow-md outline-hidden animate-in">
          <CommandList className="max-h-[600px]">
            <CommandEmpty>{t("common.no_result_found")}</CommandEmpty>
            {options?.map((data) => (
              <Fragment key={data.header}>
                {data?.option.length > 0 && (
                  <CommandGroup
                    heading={
                      <p className="text-sm font-medium text-slate-600">
                        {getOptionsTypeTranslationKey(data.header, t)}
                      </p>
                    }>
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
