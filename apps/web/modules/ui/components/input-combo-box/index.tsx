"use client";

import { CheckIcon, ChevronDownIcon, LucideProps, XIcon } from "lucide-react";
import Image from "next/image";
import React, {
  ForwardRefExoticComponent,
  Fragment,
  RefAttributes,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { isExternalImageSrc } from "@/lib/image-hosts";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/modules/ui/components/command";
import { DatePicker } from "@/modules/ui/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { countChipsThatFit } from "./lib/fit-chips";
import { filterComboboxOption } from "./lib/search";

/**
 * The height `DropdownMenuContent` caps itself at — mirrors the `max-h` on that component, which
 * is what keeps a long menu inside the viewport.
 */
const POPOVER_MAX_HEIGHT = "min(20rem, var(--radix-dropdown-menu-content-available-height, 20rem))";
/** The popover's own `p-1`, top and bottom. */
const POPOVER_PADDING = "0.5rem";

/**
 * Cap the option list at the popover's height minus its chrome, so the list is the only thing that
 * can scroll. Sized any taller — it used to be a flat `400px` against a 320px popover — the list
 * scrolls internally *and* overflows the popover, which then scrolls too, and the dropdown renders
 * two nested scrollbars. The search row is `h-8` plus its 1px bottom border.
 */
const getOptionListMaxHeight = (showSearch: boolean): string =>
  showSearch
    ? `calc(${POPOVER_MAX_HEIGHT} - ${POPOVER_PADDING} - 2rem - 1px)`
    : `calc(${POPOVER_MAX_HEIGHT} - ${POPOVER_PADDING})`;

export interface TComboboxOption {
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  imgSrc?: string;
  label: string;
  value: string | number;
  meta?: Record<string, string>;
  children?: TComboboxOption[];
  /** Listed, searchable and dimmed, but can't be picked (say why with `meta.badge` or a note nearby). */
  disabled?: boolean;
}

export interface TComboboxGroupedOption {
  label: string;
  value: string | number;
  options: TComboboxOption[];
}

export interface InputComboboxProps {
  readonly id: string;
  readonly showSearch?: boolean;
  readonly searchPlaceholder?: string;
  readonly placeholder?: string;
  readonly options?: TComboboxOption[];
  readonly groupedOptions?: TComboboxGroupedOption[];
  readonly value?: string | number | string[] | null;
  readonly onChangeValue: (
    value: string | number | string[],
    option?: TComboboxOption,
    fromInput?: boolean
  ) => void;
  readonly inputProps?: Omit<React.ComponentProps<typeof Input>, "value" | "onChange">;
  readonly clearable?: boolean;
  readonly withInput?: boolean;
  readonly allowMultiSelect?: boolean;
  readonly showCheckIcon?: boolean;
  readonly comboboxClasses?: string;
  readonly emptyDropdownText?: string;
  /**
   * Hands the search to the caller, which filters `options` itself — on the server, for a list too
   * long to load whole. The built-in filter is off then, and the search resets to "" on close.
   */
  readonly onSearchChange?: (search: string) => void;
  readonly iconClassName?: string;
  /**
   * Lets the list grow wider than its trigger (up to a cap) and wrap long labels instead of cutting
   * them, for pickers whose options are whole sentences, such as survey questions.
   */
  readonly wideDropdown?: boolean;
  readonly disabled?: boolean;
  // The interactive trigger renders as a div[role="combobox"], which is not a labelable element,
  // so a paired <label htmlFor> gives it no accessible name. Callers pass one of these instead.
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  // For a form field: what describes the trigger (its error, say), and whether its value is invalid.
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}

// Helper to flatten all options and their children
function flattenOptions(options?: TComboboxOption[]): TComboboxOption[] {
  if (!options) return [];
  return options.flatMap((option) => [option, ...(option.children ? flattenOptions(option.children) : [])]);
}

// The search terms for an option. `filterComboboxOption` scores these instead of the item's
// `value`, which is an opaque id the user never sees.
function getOptionKeywords(option: TComboboxOption): string[] {
  // The library key too, not just the label: a shared Embedded Data field renders its key beside its
  // name (ENG-1853), and the spelling on screen has to be one the search box matches — the recall
  // picker already matches on it. cmdk searches `value` (the storage key) and these keywords, and the
  // library key is neither by default.
  return option.meta?.hint ? [option.label, option.meta.hint] : [option.label];
}

function hasOptionDetails(option: TComboboxOption): boolean {
  return Boolean(option.meta?.hint || option.meta?.badge);
}

function getOptionItemClassName(wrap = false): string {
  return wrap ? "px-2" : "truncate px-2";
}

/**
 * A `date` literal is picked from {@link DatePicker}, never typed into an `<input type="date">`.
 *
 * The native control renders and parses in the *browser's* locale while the rest of the app formats
 * in the user's, so the same day read differently in two places on one screen; it also has no
 * keyboard-free path on the browsers that fall back to a plain text box. The stored value is
 * unchanged — `yyyy-MM-dd`, which is exactly what the native input emitted — so a condition written
 * before this still loads, and one written now still compares the way `evaluateLogic` expects.
 */
const isDateInput = (inputProps?: React.ComponentProps<typeof Input>): boolean => inputProps?.type === "date";

interface ComboboxOptionLabelProps {
  option: TComboboxOption;
  iconClassName: string;
  showCheckIcon: boolean;
  selected: boolean;
  wrap?: boolean;
}

function ComboboxOptionLabel({
  option,
  iconClassName,
  showCheckIcon,
  selected,
  wrap = false,
}: Readonly<ComboboxOptionLabelProps>) {
  const labelClassName = wrap
    ? "min-w-0 break-words whitespace-normal text-slate-900"
    : "truncate text-slate-900";
  return (
    <>
      {/* Every row keeps the check's room, so picked and unpicked labels line up (jobenjada #28). */}
      {showCheckIcon && (
        <CheckIcon
          className={cn("size-4 shrink-0 text-slate-800", !selected && "invisible")}
          aria-hidden="true"
        />
      )}
      {option.icon && <option.icon className={cn("shrink-0", iconClassName)} />}
      {option.imgSrc && (
        <Image
          src={option.imgSrc}
          alt={option.label}
          width={24}
          height={24}
          className="shrink-0"
          unoptimized={isExternalImageSrc(option.imgSrc)}
        />
      )}
      {hasOptionDetails(option) ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={labelClassName}>{option.label}</span>
          {option.meta?.badge && (
            <span className="shrink-0 rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
              {option.meta.badge}
            </span>
          )}
          {/*
            The hint sits at the end of the row rather than under the label so a column of them lines
            up and can be scanned on its own. It is what an identifier looks like where it is used —
            a URL parameter, an integration payload key — so it is set in mono, and `ml-auto` pins it
            right even when the label is short. `min-w-0` on both halves keeps the truncation on
            whichever one is actually too long.
          */}
          {option.meta?.hint && (
            <span className="ml-auto max-w-[45%] truncate font-mono text-xs font-normal text-slate-500">
              {option.meta.hint}
            </span>
          )}
        </span>
      ) : (
        <span className={labelClassName}>{option.label}</span>
      )}
    </>
  );
}

/** A submenu choice: its label, with a check when it is the one picked. */
function SubmenuItemLabel({ label, selected }: Readonly<{ label: string; selected: boolean }>) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CheckIcon
        className={cn("size-4 shrink-0 text-slate-800", !selected && "invisible")}
        aria-hidden="true"
      />
      <span className="truncate" title={label}>
        {label}
      </span>
    </span>
  );
}

const CHIP_GAP_PX = 4;
/** Room for the "+N" chip: two digits at `text-xs` with its padding. */
const CHIP_COUNTER_PX = 32;
const CHIP_CLASS_NAME =
  "shrink-0 rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs whitespace-nowrap text-slate-700";

/**
 * A multi-select's picks as chips on one line, with "+N" for those that don't fit (jobenjada review
 * #28: they used to stack and get cut off). An invisible copy of every chip is measured, so how many
 * show depends only on the box's width, never on what showed last.
 */
function SelectedChips({ options }: Readonly<{ options: TComboboxOption[] }>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(options.length);
  const labelsKey = options.map((option) => option.label).join("\u0000");

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure || typeof ResizeObserver === "undefined") return;
    // A ResizeObserver reports once as soon as it observes, so this also runs on mount.
    const observer = new ResizeObserver(() => {
      const widths = Array.from(measure.children).map((chip) => (chip as HTMLElement).offsetWidth);
      setVisibleCount(
        countChipsThatFit(widths, box.clientWidth, { gap: CHIP_GAP_PX, counterWidth: CHIP_COUNTER_PX })
      );
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [labelsKey]);

  const shown = options.slice(0, Math.max(1, visibleCount));
  const hiddenCount = options.length - shown.length;

  return (
    <div
      ref={boxRef}
      className="relative flex w-full min-w-0 items-center gap-1 overflow-hidden"
      title={options.map((option) => option.label).join(", ")}>
      {shown.map((option, index) => (
        <span
          key={String(option.value)}
          // The first chip may be cut short when it alone is wider than the box.
          className={cn(CHIP_CLASS_NAME, index === 0 && "min-w-0 shrink truncate")}>
          {option.label}
        </span>
      ))}
      {hiddenCount > 0 && <span className={CHIP_CLASS_NAME}>+{hiddenCount}</span>}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex gap-1 whitespace-nowrap">
        {options.map((option) => (
          <span key={String(option.value)} className={CHIP_CLASS_NAME}>
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const InputCombobox: React.FC<InputComboboxProps> = ({
  id = "temp",
  showSearch = true,
  searchPlaceholder,
  placeholder,
  options,
  groupedOptions,
  value,
  onChangeValue,
  inputProps,
  clearable = false,
  withInput = false,
  allowMultiSelect = false,
  showCheckIcon = false,
  comboboxClasses,
  emptyDropdownText,
  onSearchChange,
  iconClassName = "h-5 w-5 text-slate-400",
  wideDropdown = false,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}) => {
  const { t, i18n } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("common.search");
  const [isClearing, setIsClearing] = useState(false);
  const [open, setOpen] = useState(false);
  const [inputType, setInputType] = useState<"dropdown" | "input" | null>(null);
  const [localValue, setLocalValue] = useState<string | number | string[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const resetListScroll = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0 });
      });
    });
  };

  const validOptions = useMemo(() => {
    if (options?.length) return flattenOptions(options);
    if (groupedOptions?.length) return flattenOptions(groupedOptions.flatMap((group) => group.options));
    return [];
  }, [options, groupedOptions]);

  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalValue(null);
      setInputType(null);
    } else if (Array.isArray(value)) {
      if (value.length) {
        setLocalValue(value);
        setInputType("dropdown");
      }
    } else {
      const opt = validOptions?.find((o) => o.value === value);
      if (opt) {
        setLocalValue(opt.value);
        setInputType("dropdown");
      } else if (withInput) {
        setLocalValue(value);
        setInputType("input");
      } else {
        setLocalValue(null);
        setInputType(null);
      }
    }
  }, [value, validOptions, withInput]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // The search box unmounts with the menu, so the caller's search has to start over with it.
    if (!next) onSearchChange?.("");
  };

  const handleMultiSelect = (option: TComboboxOption) => {
    const arr = Array.isArray(localValue) ? [...localValue] : [];
    const exists = arr.includes(option.value as string);
    const newArr = exists ? arr.filter((v) => v !== option.value) : [...arr, option.value];
    if (!newArr.length) {
      onChangeValue([], option);
      setInputType(null);
    } else {
      onChangeValue(newArr as string[], option);
    }
    setLocalValue(newArr as string[]);
  };

  const handleSelect = (option: TComboboxOption) => {
    setInputType("dropdown");
    if (allowMultiSelect) {
      handleMultiSelect(option);
    } else {
      onChangeValue(option.value, option);
      setLocalValue(option.value);
      handleOpenChange(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === "number" ? +e.target.value : e.target.value;
    if (val === "") onChangeValue("", undefined, true);
    setInputType("input");
    setLocalValue(val);
    onChangeValue(val, undefined, true);
  };

  // Renders the selected option(s) inside the trigger. Not memoized: it builds a handful of
  // elements from an already-narrow option list, and the compiler would not memoize a JSX-returning
  // value anyway, so the manual memo only made the two disagree (ENG-2366).
  const renderDisplayValue = () => {
    if (Array.isArray(localValue)) {
      const picked = localValue.flatMap((v) => validOptions?.filter((o) => o.value === v).slice(0, 1) ?? []);
      return <SelectedChips options={picked} />;
    }

    // A submenu's choice can share its value with the item that opens the submenu (a matrix's "Any
    // row" and the matrix itself): show the choice, which says what was picked.
    const opt =
      validOptions?.find((o) => o.value === localValue && !o.children) ??
      validOptions?.find((o) => o.value === localValue);
    if (!opt) return null;
    return (
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {opt.icon && <opt.icon className={cn("shrink-0", iconClassName)} />}
        {opt.imgSrc && (
          <Image
            src={opt.imgSrc}
            alt={opt.label}
            width={24}
            height={24}
            unoptimized={isExternalImageSrc(opt.imgSrc)}
          />
        )}
        <span className="truncate" title={opt.label}>
          {opt.label}
        </span>
      </div>
    );
  };

  const handleClear = () => {
    setInputType(null);
    onChangeValue("");
    setLocalValue(null);
    setIsClearing(false);
  };

  const isSelected = (option: TComboboxOption) =>
    Array.isArray(localValue) ? localValue.includes(option.value as string) : localValue === option.value;

  return (
    // The height lives on this wrapper rather than on the trigger below: the wrapper clips its children
    // (overflow-hidden), so a fixed-height trigger inside a shorter wrapper (comboboxClasses="h-9") gets
    // cropped and its centered content sits low next to same-height controls in a filter row.
    <div
      className={cn(
        "group/icon flex h-10 max-w-[440px] min-w-0 overflow-hidden rounded-md border border-slate-300 hover:border-slate-400",
        // A plain dropdown with nothing picked keeps room for a value. In a box that sizes to its
        // content (the Set value field picker) it otherwise shrank to its chevron.
        !withInput && inputType !== "dropdown" && "min-w-32",
        disabled && "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60 hover:border-slate-200",
        comboboxClasses
      )}>
      {withInput && inputType !== "dropdown" && !isDateInput(inputProps) && (
        <Input
          id={`${id}-input`}
          {...inputProps}
          disabled={disabled || inputProps?.disabled}
          className={cn(
            "min-w-0 flex-1 rounded-none border-0 border-r border-slate-300 bg-white focus:border-r-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0",
            inputProps?.className
          )}
          value={localValue ?? ""}
          onChange={onInputChange}
        />
      )}

      {withInput && inputType !== "dropdown" && isDateInput(inputProps) && (
        <DatePicker
          value={parseStoredDay(typeof localValue === "string" ? localValue : null)}
          locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
          disabled={disabled || inputProps?.disabled}
          // `inputProps.placeholder` deliberately NOT forwarded: every caller passes the text
          // branch's "Select or type value", and typing is the one thing this control removed.
          // `DatePicker`'s own fallback ("Pick a date") is the copy that matches what it offers.
          // The trigger insists on 280px of its own; inside this row it is the flex item that has to
          // give, and the border is the wrapper's so the picker drops its own right edge into it.
          className="min-w-0 flex-1"
          // `px-2` rather than the Button default's `px-4`: the logic card gives this column about
          // 190px, and the icon plus default padding left too little for a formatted day.
          triggerClassName="h-full w-full rounded-none border-0 border-r border-slate-300 px-2"
          // The wrapper already draws the hairline — see `triggerClassName` dropping the trigger's.
          clearButtonClassName="border-0 shadow-none"
          onChange={(date) => {
            const day = formatLocalDay(date);
            setInputType("input");
            setLocalValue(day);
            onChangeValue(day, undefined, true);
          }}
          // Without this a picked day cannot be taken back: `DatePicker` only ever emits from
          // `onSelect`, and it renders its own clear button solely when handed an `onClear`. The
          // wrapper's `XIcon` is no fallback either — it is gated on `inputType === "dropdown"`, and
          // picking a date sets that to `"input"`. Emptying the stored day is what the text and
          // number branches already do from `onInputChange` when their box is cleared.
          onClear={() => {
            setInputType("input");
            setLocalValue("");
            onChangeValue("", undefined, true);
          }}
        />
      )}

      <DropdownMenu open={disabled ? false : open} onOpenChange={disabled ? undefined : handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <div
            id={id}
            role="combobox"
            tabIndex={disabled ? -1 : 0}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-controls="options"
            aria-expanded={open}
            aria-disabled={disabled || undefined}
            // Next to the input or date picker the trigger is a fixed 40px chevron, and they take the
            // rest. It must not also grow: a `flex-1` (basis 0) here squeezed it to nothing beside a
            // full-width input, which hid the picker (jobenjada review #21), and split the row in half
            // beside the date picker (#29).
            className={cn(
              "z-10 flex h-full w-full min-w-0 flex-1 cursor-pointer items-center overflow-hidden bg-white pr-2 text-sm",
              {
                "w-10 flex-none justify-center pr-0": withInput && inputType !== "dropdown",
                "pointer-events-none": isClearing || disabled,
                "cursor-not-allowed bg-transparent": disabled,
              }
            )}>
            {inputType === "dropdown" ? (
              <div className="min-w-0 flex-1 truncate px-2 text-sm">{renderDisplayValue()}</div>
            ) : (
              placeholder && (
                <span className="min-w-0 flex-1 truncate px-2 text-sm text-slate-400">{placeholder}</span>
              )
            )}
            {clearable && inputType === "dropdown" ? (
              <XIcon
                className={cn("size-5 shrink-0 text-slate-300 hover:text-slate-400", {
                  "pointer-events-auto": isClearing,
                })}
                onMouseEnter={() => setIsClearing(true)}
                onMouseLeave={() => setIsClearing(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              />
            ) : (
              <ChevronDownIcon
                className={cn(
                  "size-5 shrink-0 text-slate-300 group-hover/icon:text-slate-400",
                  // Pin the chevron to the right even when there's no value/placeholder to render a
                  // leading flex-1 element — otherwise it collapses to the left and looks broken.
                  // Skip in the centered icon-only (withInput) variant so it stays centered.
                  !(withInput && inputType !== "dropdown") && "ml-auto"
                )}
              />
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="start"
          className={cn(
            "min-w-52 overflow-y-hidden",
            wideDropdown
              ? "w-max max-w-[min(36rem,calc(100vw-2rem))] min-w-(--radix-dropdown-menu-trigger-width)"
              : "w-(--radix-dropdown-menu-trigger-width)"
          )}
          data-testid="dropdown-menu-content">
          <Command
            className="flex h-full w-full flex-col overflow-hidden"
            filter={filterComboboxOption}
            shouldFilter={!onSearchChange}>
            {showSearch ? (
              <div className="border-b border-slate-100">
                <CommandInput
                  placeholder={resolvedSearchPlaceholder}
                  className="h-8 border-none placeholder-slate-300 outline-hidden"
                  autoFocus
                  ref={searchRef}
                  onValueChange={(search) => {
                    resetListScroll();
                    onSearchChange?.(search);
                  }}
                />
              </div>
            ) : (
              <button autoFocus className="sr-only" aria-hidden type="button" />
            )}

            <CommandList
              ref={listRef}
              className="subtle-scrollbar max-h-none overflow-y-auto border-0 p-1"
              style={{ maxHeight: getOptionListMaxHeight(showSearch) }}>
              <CommandEmpty className="mx-2 my-0 text-xs font-semibold text-slate-500">
                {emptyDropdownText ?? t("workspace.surveys.edit.no_option_found")}
              </CommandEmpty>

              {options && options.length > 0 && (
                <CommandGroup className="p-0">
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={String(opt.value)}
                      keywords={getOptionKeywords(opt)}
                      disabled={opt.disabled}
                      onSelect={() => handleSelect(opt)}
                      className={getOptionItemClassName(wideDropdown)}>
                      <ComboboxOptionLabel
                        option={opt}
                        iconClassName={iconClassName}
                        showCheckIcon={showCheckIcon}
                        selected={isSelected(opt)}
                        wrap={wideDropdown}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {groupedOptions?.map((group, gi) => (
                <Fragment key={gi}>
                  {gi > 0 && <CommandSeparator className="my-1 bg-slate-200" />}
                  <CommandGroup className="p-0" tabIndex={0}>
                    <div className="px-2 pb-2 text-xs font-medium text-slate-500">{group.label}</div>
                    {group.options.map((opt) =>
                      opt.children ? (
                        <CommandItem
                          key={opt.value}
                          value={String(opt.value)}
                          keywords={getOptionKeywords(opt)}
                          className="flex w-full items-center justify-center p-0">
                          <DropdownMenuSub key={opt.value}>
                            <DropdownMenuSubTrigger
                              className="w-full"
                              onFocus={(e) => {
                                if (e.relatedTarget === searchRef.current) {
                                  searchRef.current?.focus();
                                }
                              }}>
                              {/* The option's badge too: a matrix says it is one (jobenjada review #27). */}
                              <div className="flex w-full min-w-0 items-center gap-2">
                                <ComboboxOptionLabel
                                  option={opt}
                                  iconClassName={iconClassName}
                                  showCheckIcon={showCheckIcon}
                                  selected={isSelected(opt)}
                                />
                              </div>
                            </DropdownMenuSubTrigger>
                            {/* Wide enough for "Editor (grid · …)" on one line; the chosen one is checked. */}
                            <DropdownMenuSubContent alignOffset={4} className="w-max max-w-80 min-w-48 p-1">
                              {opt.children.map((child) => (
                                <div className="flex flex-col" key={child.value}>
                                  {child.children && child.children.length > 0 ? (
                                    <p className="mb-2 px-2 text-sm font-medium text-slate-500">
                                      {child.label}
                                    </p>
                                  ) : (
                                    <DropdownMenuItem key={child.value} onSelect={() => handleSelect(child)}>
                                      <SubmenuItemLabel label={child.label} selected={isSelected(child)} />
                                    </DropdownMenuItem>
                                  )}
                                  {child.children?.map((subChild) => (
                                    <DropdownMenuItem
                                      key={subChild.value}
                                      onSelect={() => handleSelect(subChild)}>
                                      <SubmenuItemLabel
                                        label={subChild.label}
                                        selected={isSelected(subChild)}
                                      />
                                    </DropdownMenuItem>
                                  ))}

                                  {child.children && child.children.length > 0 && <DropdownMenuSeparator />}
                                </div>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </CommandItem>
                      ) : (
                        <CommandItem
                          key={opt.value}
                          value={String(opt.value)}
                          keywords={getOptionKeywords(opt)}
                          disabled={opt.disabled}
                          onSelect={() => handleSelect(opt)}
                          className={getOptionItemClassName(wideDropdown)}>
                          <ComboboxOptionLabel
                            option={opt}
                            iconClassName={iconClassName}
                            showCheckIcon={showCheckIcon}
                            selected={isSelected(opt)}
                            wrap={wideDropdown}
                          />
                        </CommandItem>
                      )
                    )}
                  </CommandGroup>
                </Fragment>
              ))}
            </CommandList>
          </Command>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
