import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { getSurveyLanguageTag, isRTLLanguage } from "@/lib/utils";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: Readonly<SurveyContainerProps>) {
  const [isOpen, setIsOpen] = useState(true);
  const onFinishedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { onClose, onLanguageChange } = props;
  const isRTL = isRTLLanguage(props.survey, props.languageCode);
  const [dir, setDir] = useState<"ltr" | "rtl" | "auto">(isRTL ? "rtl" : "ltr");
  const [languageTag, setLanguageTag] = useState<string | null>(() =>
    getSurveyLanguageTag(props.survey, props.languageCode)
  );

  useEffect(() => {
    const isRTL = isRTLLanguage(props.survey, props.languageCode);
    setDir(isRTL ? "rtl" : "ltr");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only recalculate direction when languageCode changes, not on survey auto-save
  }, [props.languageCode]);

  // Survey declares its own language on the #fbjs root (WCAG 3.1.1). This is the only place that
  // covers embedded and app surveys: a link survey's host also sets <html lang>, but the JS widget
  // is dropped into someone else's document and must never touch it, so without this it inherits
  // the host page's language no matter what language the survey is in.
  //
  // The active language lives in Survey's own state, and it already reports every change through
  // onLanguageChange. Wrapping that callback keeps a single source of truth rather than adding a
  // second channel out of Survey.
  //
  // The survey is read through a ref, deliberately kept OUT of the dependency list. `onLanguageChange`
  // is a public prop, and Survey's reporting effect is keyed on its identity — so if this callback were
  // rebuilt whenever the survey object changed, that effect would re-fire on renders where no language
  // changed. The editor preview passes a freshly built survey object on every render, which would make
  // a host's handler run on every keystroke.
  const surveyRef = useRef(props.survey);
  useEffect(() => {
    surveyRef.current = props.survey;
  }, [props.survey]);

  const handleLanguageChange = useCallback(
    (languageCode: string) => {
      setLanguageTag(getSurveyLanguageTag(surveyRef.current, languageCode));
      onLanguageChange?.(languageCode);
    },
    [onLanguageChange]
  );

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
      lang={languageTag}>
      <Survey
        {...props}
        onLanguageChange={handleLanguageChange}
        autoFocus={autoFocus}
        clickOutside={hasOverlay ? props.clickOutside : true}
        onClose={close}
        onFinished={() => {
          props.onFinished?.();

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
