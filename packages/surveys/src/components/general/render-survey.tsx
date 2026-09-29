import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { getSurveyDisplayName, hasSurveyInstructions } from "@/lib/survey-page";
import { getSurveyLanguageTag, isRTLLanguage } from "@/lib/utils";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: Readonly<SurveyContainerProps>) {
  const [isOpen, setIsOpen] = useState(true);
  const onFinishedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { onClose, onLanguageChange } = props;
  const [activeLanguageCode, setActiveLanguageCode] = useState(props.languageCode);
  const isRTL = isRTLLanguage(props.survey, props.languageCode);
  const [dir, setDir] = useState<"ltr" | "rtl" | "auto">(isRTL ? "rtl" : "ltr");

  // Direction is recalculated from the ACTIVE language, the same input the lang attribute below
  // resolves from, so the two cannot disagree. Keying this on props.languageCode instead would miss
  // every change that does not come from the host: a language switch, or a fallback when the active
  // language is no longer configured. That combination is what produced conflicting attributes —
  // lang="en-US" next to dir="rtl" — on a survey whose selected language had been removed.
  //
  // The survey is a real dependency, not noise: isRTLLanguage reads its language list, and for a
  // survey with none configured it sniffs the direction from the content itself. The lang attribute
  // below is resolved during render and so already tracks the survey — leaving it out here is what
  // would let the two drift apart. Re-running on an unrelated survey edit is harmless; setDir with
  // an unchanged value is a no-op.
  useEffect(() => {
    const isRTL = isRTLLanguage(props.survey, activeLanguageCode);
    setDir(isRTL ? "rtl" : "ltr");
  }, [activeLanguageCode, props.survey]);

  // Survey declares its own language on the #fbjs root (WCAG 3.1.1). This is the only place that
  // covers embedded and app surveys: a link survey's host also sets <html lang>, but the JS widget
  // is dropped into someone else's document and must never touch it, so without this it inherits
  // the host page's language no matter what language the survey is in.
  //
  // The active language lives in Survey's own state, and it already reports every change through
  // onLanguageChange. Wrapping that callback keeps a single source of truth rather than adding a
  // second channel out of Survey.
  //
  // Only the CODE is held in state; the tag is resolved during render. That keeps this callback's
  // identity stable — `onLanguageChange` is a public prop and Survey's reporting effect is keyed on it,
  // so a callback rebuilt on every survey-object change would re-fire that effect on renders where no
  // language changed (the editor preview builds a fresh survey object on every keystroke). It also
  // means a survey edited mid-session — a language disabled or removed — re-resolves the tag on the
  // next render rather than leaving a stale one on the DOM.
  const handleLanguageChange = useCallback(
    (languageCode: string) => {
      setActiveLanguageCode(languageCode);
      onLanguageChange?.(languageCode);
    },
    [onLanguageChange]
  );

  const languageTag = getSurveyLanguageTag(props.survey, activeLanguageCode);

  const close = useCallback(() => {
    if (onFinishedTimeoutRef.current) {
      clearTimeout(onFinishedTimeoutRef.current);
      onFinishedTimeoutRef.current = null;
    }

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setIsOpen(false);

    closeTimeoutRef.current = setTimeout(() => {
      onClose?.();
    }, 1000);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (onFinishedTimeoutRef.current) {
        clearTimeout(onFinishedTimeoutRef.current);
      }

      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const mode = props.mode ?? "modal";
  const hasOverlay = props.overlay && props.overlay !== "none";
  // A modal survey with no overlay appears over a page the user is still working in, often mid-form.
  // Moving the caret into the survey on open would pull them out of the field they are typing in, so
  // leave focus where it is. With an overlay the page is blocked anyway, so taking focus is correct.
  // Only ever force this off — everything else keeps the existing default (see survey.tsx).
  const autoFocus = props.autoFocus ?? (mode === "modal" && !hasOverlay ? false : undefined);

  return (
    <SurveyContainer
      mode={mode}
      placement={props.placement}
      overlay={props.overlay}
      clickOutside={props.clickOutside}
      onClose={close}
      isOpen={isOpen}
      dir={dir}
      surveyName={getSurveyDisplayName(props.survey.name)}
      hasInstructions={hasSurveyInstructions(props.survey)}
      lang={languageTag}>
      <Survey
        {...props}
        onLanguageChange={handleLanguageChange}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- renamed to autoFocusEnabled; focus is imperative
        autoFocus={autoFocus}
        clickOutside={hasOverlay ? props.clickOutside : true}
        onClose={close}
        onFinished={(responseId?: string) => {
          props.onFinished?.(responseId);

          if (props.mode !== "inline") {
            onFinishedTimeoutRef.current = setTimeout(
              () => {
                const firstEnabledEnding = props.survey.endings?.[0];
                if (firstEnabledEnding?.type !== "redirectToUrl") {
                  close();
                }
              },
              props.survey.endings.length ? 3000 : 0 // close modal automatically after 3 seconds if no ending is enabled; otherwise, close immediately
            );
          }
        }}
        dir={dir}
        setDir={setDir}
      />
    </SurveyContainer>
  );
}
