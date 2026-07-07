import { type JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { ProgressBar } from "@/components/general/progress-bar";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { cn } from "@/lib/utils";

interface CardlessSurveyLayoutProps {
  children: JSX.Element;
  survey: TJsWorkspaceStateSurvey;
  blockId: string;
  styling: TSurveyStyling | TWorkspaceStyling;
  showProgressBar: boolean;
  isPreviewMode: boolean;
  showCardlessPreviewLogoSlot: boolean;
  linkSurveyCardMaxWidth?: string;
}

/**
 * Full-height layout for cardless link surveys: an optional progress bar, an optional preview logo
 * slot, and a scrollable content area with top/bottom fade overlays plus a scroll-to-bottom button.
 */
export function CardlessSurveyLayout({
  children,
  survey,
  blockId,
  styling,
  showProgressBar,
  showCardlessPreviewLogoSlot,
  linkSurveyCardMaxWidth,
}: Readonly<CardlessSurveyLayoutProps>) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrollAtTop, setIsScrollAtTop] = useState(true);
  const [isScrollAtBottom, setIsScrollAtBottom] = useState(false);

  const isSolidColorBackground = !styling.background?.bgType || styling.background.bgType === "color";

  const fadeColor = useMemo(() => {
    if (isSolidColorBackground && styling.background?.bg) {
      return styling.background.bg;
    }

    return "#ffffff";
  }, [isSolidColorBackground, styling.background?.bg]);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const tolerance = 1;

    setIsScrollAtBottom(scrollTop + clientHeight >= scrollHeight - tolerance);
    setIsScrollAtTop(scrollTop <= tolerance);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      checkScroll();
    };

    element.addEventListener("scroll", handleScroll);
    checkScroll();

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [checkScroll]);

  // Re-check the scroll position whenever the visible card changes, since the content height changes.
  useEffect(() => {
    checkScroll();
  }, [blockId, checkScroll]);

  // The welcome card has no progress yet; a 0% bar reads as a stray band, so hide it on the welcome card.
  const showProgressBarRow = showProgressBar && blockId !== "start";
  const cardMaxWidthStyle = linkSurveyCardMaxWidth ? { maxWidth: linkSurveyCardMaxWidth } : undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {showProgressBarRow ? (
        <div className="cardless-progress-bar z-[100] w-full shrink-0">
          <ProgressBar survey={survey} blockId={blockId} />
        </div>
      ) : null}
      {showCardlessPreviewLogoSlot ? (
        <div
          id="formbricks-cardless-preview-logo-slot"
          className="mx-auto w-full shrink-0 px-4 pt-5 pb-2 sm:px-6 sm:pt-6"
          style={cardMaxWidthStyle}
        />
      ) : null}
      <div className="relative min-h-0 flex-1">
        {isSolidColorBackground && !isScrollAtTop && (
          <div
            className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-4"
            style={{ background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }}
          />
        )}
        <div ref={scrollRef} className="h-full min-h-0 overflow-y-auto">
          <div
            className={cn(
              // Extra bottom padding keeps the last card clear of the floating scroll-to-bottom button.
              "mx-auto flex w-full flex-col items-center px-4 pb-12 sm:px-6",
              showCardlessPreviewLogoSlot ? "pt-6" : "pt-10 sm:pt-12"
            )}
            style={cardMaxWidthStyle}>
            <div className="w-full">{children}</div>
          </div>
        </div>
        {!isScrollAtBottom && (
          <>
            {isSolidColorBackground && (
              <div
                className="pointer-events-none absolute right-4 bottom-0 left-4 z-10 h-10"
                style={{ background: `linear-gradient(to top, ${fadeColor}, transparent)` }}
              />
            )}
            <button
              type="button"
              onClick={scrollToBottom}
              style={{
                transform: "translateX(-50%)",
                ...(isSolidColorBackground ? { backgroundColor: fadeColor } : undefined),
              }}
              className={cn(
                "hover:border-border focus:ring-brand absolute bottom-2 left-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-transparent shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
                !isSolidColorBackground && "bg-survey-bg/90 backdrop-blur-sm"
              )}
              aria-label={t("common.scroll_to_bottom")}>
              <ChevronDownIcon className="text-heading h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
