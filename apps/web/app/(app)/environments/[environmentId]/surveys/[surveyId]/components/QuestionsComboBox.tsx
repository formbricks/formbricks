"use client";

import clsx from "clsx";
import {
  CheckIcon,
  HashIcon,
  HelpCircleIcon,
  ImageIcon,
  ListIcon,
  MousePointerClickIcon,
  Rows3Icon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import useClickOutside from "@formbricks/lib/useClickOutside";
import { TSurveyQuestionType } from "@formbricks/types/surveys";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@formbricks/ui/Command";
import { NetPromoterScoreIcon } from "@formbricks/ui/icons";

export enum OptionsType {
  QUESTIONS = "Questions",
  TAGS = "Tags",
  ATTRIBUTES = "Attributes",
}

export type QuestionOption = {
  label: string;
  questionType?: TSurveyQuestionType;
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
    if (type === OptionsType.QUESTIONS) {
      switch (questionType) {
        case TSurveyQuestionType.Rating:
          return <StarIcon width={18} className="text-white" />;
        case TSurveyQuestionType.CTA:
          return <MousePointerClickIcon width={18} className="text-white" />;
        case TSurveyQuestionType.OpenText:
          return <HelpCircleIcon width={18} className="text-white" />;
        case TSurveyQuestionType.MultipleChoiceMulti:
          return <ListIcon width={18} className="text-white" />;
        case TSurveyQuestionType.MultipleChoiceSingle:
          return <Rows3Icon width={18} className="text-white" />;
        case TSurveyQuestionType.NPS:
          return <NetPromoterScoreIcon width={18} height={18} className="text-white" />;
        case TSurveyQuestionType.Consent:
          return <CheckIcon width={18} height={18} className="text-white" />;
        case TSurveyQuestionType.PictureSelection:
          return <ImageIcon width={18} className="text-white" />;
      }
    }
    if (type === OptionsType.ATTRIBUTES) {
      return <HashIcon width={18} className="text-white" />;
    }
    if (type === OptionsType.TAGS) {
      return <TagIcon width={18} className="text-white" />;
    }
  };

  const getColor = () => {
    if (type === OptionsType.ATTRIBUTES) {
      return "bg-indigo-500";
    } else if (type === OptionsType.QUESTIONS) {
      return "bg-brand-dark";
    } else {
      return "bg-amber-500";
    }
  };
  return (
    <div className="flex h-5 w-[12rem] items-center sm:w-4/5">
      <span className={clsx("rounded-md p-1", getColor())}>{getIconType()}</span>
      <p className="ml-3 truncate text-base text-slate-600">{label}</p>
    </div>
  );
};

const QuestionsComboBox = ({ options, selected, onChangeValue }: QuestionComboBoxProps) => {
  const [open, setOpen] = React.useState(false);
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
            placeholder="Search..."
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
            <CommandEmpty>No result found.</CommandEmpty>
            {options?.map((data) => (
              <>
                {data?.option.length > 0 && (
                  <CommandGroup heading={<p className="text-sm font-normal text-slate-600">{data.header}</p>}>
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
          </div>
        )}
      </div>
    </Command>
  );
};

export default QuestionsComboBox;
