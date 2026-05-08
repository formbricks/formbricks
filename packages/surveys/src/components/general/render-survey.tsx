import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { isRTLLanguage } from "@/lib/utils";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: SurveyContainerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const onFinishedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { onClose } = props;
  const isRTL = isRTLLanguage(props.survey, props.languageCode);
  const [dir, setDir] = useState<"ltr" | "rtl" | "auto">(isRTL ? "rtl" : "ltr");

  useEffect(() => {
    const isRTL = isRTLLanguage(props.survey, props.languageCode);
    setDir(isRTL ? "rtl" : "ltr");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only recalculate direction when languageCode changes, not on survey auto-save
  }, [props.languageCode]);

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

  const hasOverlay = props.overlay && props.overlay !== "none";

  return (
    <SurveyContainer
      mode={props.mode ?? "modal"}
      placement={props.placement}
      overlay={props.overlay}
      clickOutside={props.clickOutside}
      onClose={close}
      isOpen={isOpen}
      dir={dir}>
      <Survey
        {...props}
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
