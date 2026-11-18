import { Maximize2 } from "lucide-react";
import * as React from "react";
import { Checkbox } from "@/components/general/checkbox";
import { ElementError, getElementErrorAria } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { ImageLightbox } from "@/components/general/image-lightbox";
import { FB_PART } from "@/lib/parts";
import { useRovingRadioGroup } from "@/lib/use-roving-radio-group";
import { cn } from "@/lib/utils";

/**
 * Picture option for picture select element
 */
export interface PictureSelectOption {
  /** Unique identifier for the option */
  id: string;
  /** URL of the image */
  imageUrl: string;
  /** Alt text for the image */
  alt?: string;
}

interface PictureSelectProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the picture select group */
  inputId: string;
  /** Array of picture options to choose from */
  options: PictureSelectOption[];
  /** Currently selected option ID(s) - string for single select, string[] for multi select */
  value?: string | string[];
  /** Callback function called when selection changes */
  onChange: (value: string | string[]) => void;
  /** Whether multiple selections are allowed */
  allowMulti?: boolean;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the options are disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Alt text for the image; empty or absent marks it decorative */
  imageAltText?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
  /** Accessible name of an option's enlarge button, given the option's alt text */
  getEnlargeImageLabel?: (alt: string) => string;
  /** Accessible name of the enlarged view's close button */
  closeLabel?: string;
}

const defaultEnlargeImageLabel = (alt: string): string => `Enlarge ${alt}`;

interface EnlargeImageButtonProps {
  label: string;
  onClick: () => void;
}

/**
 * Opens an option's picture in the lightbox. It sits next to the option's `<label>`, never inside it:
 * a button inside the label would also toggle the option (and, for single select, could auto-progress).
 * Always visible rather than revealed on hover, so touch and keyboard users can find it too.
 */
function EnlargeImageButton({ label, onClick }: Readonly<EnlargeImageButtonProps>): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute end-[5%] bottom-[5%] flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-slate-800/60 p-0 text-white backdrop-blur-sm transition-colors hover:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:outline-none">
      <Maximize2 aria-hidden="true" className="size-4" />
    </button>
  );
}

function PictureSelect({
  elementId,
  headline,
  description,
  inputId,
  options,
  value,
  onChange,
  allowMulti = false,
  required = false,
  requiredLabel,
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  imageAltText,
  videoUrl,
  getEnlargeImageLabel = defaultEnlargeImageLabel,
  closeLabel,
}: Readonly<PictureSelectProps>): React.JSX.Element {
  const errorAria = getElementErrorAria(inputId, errorMessage);
  const [enlargedOptionId, setEnlargedOptionId] = React.useState<string | null>(null);
  const enlargedOption = options.find((option) => option.id === enlargedOptionId);
  const getOptionAlt = (option: PictureSelectOption): string => option.alt ?? `Option ${option.id}`;

  // Ensure value is always the correct type
  let selectedValues: string[] | string | undefined;
  if (allowMulti) {
    selectedValues = Array.isArray(value) ? value : [];
  } else {
    selectedValues = typeof value === "string" ? value : undefined;
  }

  const handleMultiSelectChange = (optionId: string, checked: boolean): void => {
    if (disabled) return;

    const currentArray = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentArray, optionId]);
    } else {
      onChange(currentArray.filter((id) => id !== optionId));
    }
  };

  const handleSingleSelectChange = (newValue: string): void => {
    if (disabled) return;
    onChange(newValue);
  };

  // Single select is a radio group whose selection can trigger auto-progress,
  // so arrow-key focus moves must not select (see useRovingRadioGroup).
  const { getRadioProps } = useRovingRadioGroup({
    values: options.map((option) => option.id),
    selectedValue: allowMulti ? undefined : (selectedValues as string | undefined),
    onSelect: handleSingleSelectChange,
  });

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline: referenced by the option group via aria-labelledby (a htmlFor here
          would dangle — no control carries the bare inputId). */}
      <ElementHeader
        headlineId={`${inputId}-headline`}
        headline={headline}
        description={description}
        required={required}
        requiredLabel={requiredLabel}
        imageUrl={imageUrl}
        imageAltText={imageAltText}
        videoUrl={videoUrl}
      />

      {/* Picture Grid - 2 columns */}
      <div className="relative" data-element-input>
        <ElementError errorMessage={errorMessage} dir={dir} id={errorAria.errorId} />
        {allowMulti ? (
          // Native fieldset (group role) named by the headline; m-0/p-0/border-0/w-full
          // reset the fieldset UA defaults so it lays out like a plain div.
          <fieldset
            aria-labelledby={`${inputId}-headline`}
            aria-invalid={errorAria.ariaInvalid}
            aria-describedby={errorAria.ariaDescribedBy}
            className="m-0 grid w-full min-w-0 grid-cols-2 gap-2 border-0 p-0">
            {options.map((option) => {
              const isSelected = (selectedValues as string[]).includes(option.id);
              const optionId = `${inputId}-${option.id}`;

              return (
                <div key={option.id} className="relative">
                  <label
                    htmlFor={optionId}
                    data-fb-part={FB_PART.option}
                    data-checked={isSelected ? "true" : undefined}
                    className={cn(
                      "rounded-option relative block aspect-[162/97] w-full cursor-pointer transition-all",
                      disabled && "cursor-not-allowed opacity-50"
                    )}>
                    {/* Image container with border when selected */}
                    <div
                      className={cn(
                        "rounded-option absolute inset-[2px] overflow-hidden",
                        isSelected && "border-brand border-4 border-solid"
                      )}>
                      <img
                        src={option.imageUrl}
                        alt={getOptionAlt(option)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {/* Selection indicator - Checkbox for multi select */}
                    <div
                      className="absolute top-[5%] right-[5%]"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}>
                      <Checkbox
                        id={optionId}
                        data-fb-part={FB_PART.optionControl}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          handleMultiSelectChange(option.id, checked === true);
                        }}
                        disabled={disabled}
                        className="h-4 w-4"
                        aria-label={option.alt ?? `Select ${option.id}`}
                      />
                    </div>
                  </label>
                  <EnlargeImageButton
                    label={getEnlargeImageLabel(getOptionAlt(option))}
                    onClick={() => {
                      setEnlargedOptionId(option.id);
                    }}
                  />
                </div>
              );
            })}
          </fieldset>
        ) : (
          // Native radios instead of a Radix radio group: Radix moves selection with
          // arrow-key focus, which would trigger auto-progress while a keyboard user
          // is still browsing the pictures. The roving hook decouples the two.
          <div
            role="radiogroup"
            aria-labelledby={`${inputId}-headline`}
            aria-required={required}
            aria-invalid={errorAria.ariaInvalid}
            aria-describedby={errorAria.ariaDescribedBy}
            className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const optionId = `${inputId}-${option.id}`;
              const isSelected = selectedValues === option.id;

              return (
                <div key={option.id} className="relative">
                  <label
                    htmlFor={optionId}
                    data-fb-part={FB_PART.option}
                    data-checked={isSelected ? "true" : undefined}
                    className={cn(
                      "rounded-option relative block aspect-[162/97] w-full cursor-pointer transition-all",
                      disabled && "cursor-not-allowed opacity-50"
                    )}>
                    <input
                      type="radio"
                      id={optionId}
                      name={inputId}
                      value={option.id}
                      checked={isSelected}
                      disabled={disabled}
                      className="peer sr-only"
                      aria-label={option.alt ?? `Select ${option.id}`}
                      onChange={() => {
                        handleSingleSelectChange(option.id);
                      }}
                      {...getRadioProps(option.id)}
                    />
                    {/* Image container with border when selected */}
                    <div
                      className={cn(
                        "rounded-option absolute inset-[2px] overflow-hidden",
                        isSelected && "border-brand border-4 border-solid"
                      )}>
                      <img
                        src={option.imageUrl}
                        alt={getOptionAlt(option)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {/* Selection indicator dot, painted from the hidden input's state */}
                    <span
                      aria-hidden="true"
                      data-fb-part={FB_PART.optionControl}
                      className={cn(
                        "border-input-border dark:bg-input-bg absolute top-[5%] right-[5%] flex size-4 items-center justify-center rounded-full border bg-white shadow-xs transition-colors",
                        isSelected && "border-brand"
                      )}>
                      <span
                        className={cn(
                          "size-2 rounded-full transition-colors",
                          isSelected ? "bg-brand" : "bg-transparent"
                        )}
                      />
                    </span>
                  </label>
                  <EnlargeImageButton
                    label={getEnlargeImageLabel(getOptionAlt(option))}
                    onClick={() => {
                      setEnlargedOptionId(option.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ImageLightbox
        imageUrl={enlargedOption?.imageUrl ?? null}
        alt={enlargedOption ? getOptionAlt(enlargedOption) : ""}
        onClose={() => {
          setEnlargedOptionId(null);
        }}
        closeLabel={closeLabel}
      />
    </div>
  );
}

export { PictureSelect };
export type { PictureSelectProps };
