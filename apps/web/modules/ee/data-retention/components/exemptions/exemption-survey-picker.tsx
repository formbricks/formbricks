"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type ComponentPropsWithoutRef, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useRetentionExemptionSurveyOptions } from "../../hooks/use-retention-exemptions";
import { getRetentionErrorMessage } from "../../lib/error-message";
import type { TRetentionExemptionSurveyOption } from "../../types";

const SEARCH_DEBOUNCE_MS = 250;

/** `id` and `aria-*` arrive from `FormControl`, which labels the trigger button through them. */
interface ExemptionSurveyPickerProps extends Pick<
  ComponentPropsWithoutRef<"button">,
  "id" | "aria-describedby" | "aria-invalid"
> {
  organizationId: string;
  value: TRetentionExemptionSurveyOption | null;
  onChange: (survey: TRetentionExemptionSurveyOption) => void;
  isInvalid?: boolean;
  disabled?: boolean;
}

/** Any survey in the organisation, searched by name on the server as the user types. */
export const ExemptionSurveyPicker = ({
  organizationId,
  value,
  onChange,
  isInvalid,
  disabled,
  ...buttonProps
}: Readonly<ExemptionSurveyPickerProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverId = useId();
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const {
    data: surveys = [],
    isFetching,
    error,
  } = useRetentionExemptionSurveyOptions({
    organizationId,
    search: debouncedSearch,
    enabled: open,
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const getEmptyMessage = () => {
    if (error) return getRetentionErrorMessage(error, t, t("common.something_went_wrong_please_try_again"));
    if (isFetching) return <LoadingSpinner className="size-4" />;
    return t("common.no_surveys_found");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          {...buttonProps}
          type="button"
          // A combobox, like the kit's Select trigger, so the chosen survey is read as its value. It
          // controls the popover that holds the search and the list, which is only mounted while open,
          // so the reference is only set then (an `aria-controls` must name an element that exists).
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 focus:outline-hidden hover:enabled:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
            isInvalid && "border-red-500"
          )}>
          <span className={cn("truncate", !value && "text-slate-500")}>
            {value ? value.name : t("common.select_survey")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={popoverId} className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t("workspace.settings.data_retention.search_surveys")}
          />
          <CommandList>
            {surveys.length === 0 ? (
              <CommandEmpty>{getEmptyMessage()}</CommandEmpty>
            ) : (
              <CommandGroup>
                {surveys.map((survey) => (
                  <CommandItem
                    key={survey.id}
                    value={survey.id}
                    onSelect={() => {
                      onChange(survey);
                      handleOpenChange(false);
                    }}>
                    <CheckIcon
                      className={cn("size-4 shrink-0", value?.id === survey.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0 flex-1 truncate">{survey.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{survey.workspaceName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
