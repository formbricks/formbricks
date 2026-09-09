import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { cn } from "@/lib/utils";

interface ScrollToBottomButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * The floating affordance that scrolls an overflowing card to its end.
 *
 * While it is visible the submit button is below the fold, so this *is* the primary next action
 * (ENG-1783) — hence it borrows the primary button's themed colors (`--fb-button-bg-color` /
 * `--fb-button-text-color`) instead of blending into the card or page background. It deliberately
 * does not use the `.button-custom` class: that class also applies the button height, radius and
 * padding a survey may have customised, which would stretch this circle out of shape.
 */
export function ScrollToBottomButton({ onClick, className }: Readonly<ScrollToBottomButtonProps>) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        transform: "translateX(-50%)",
        backgroundColor: "var(--fb-button-bg-color)",
        color: "var(--fb-button-text-color)",
      }}
      className={cn(
        "border-submit-button-border focus:ring-focus absolute bottom-2 left-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-opacity hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
        className
      )}
      aria-label={t("common.scroll_to_bottom")}>
      <ChevronDownIcon className="h-5 w-5" />
    </button>
  );
}
