import { useEffect, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: SurveyContainerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const onFinishedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const close = () => {
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
      if (props.onClose) {
        props.onClose();
      }
    }, 1000);
  };

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

  return (
    <SurveyContainer
      mode={props.mode ?? "modal"}
      placement={props.placement}
      darkOverlay={props.darkOverlay}
      clickOutside={props.clickOutside}
      ignorePlacementForClickOutside={props.ignorePlacementForClickOutside}
      onClose={close}
      isOpen={isOpen}>
      {/* @ts-expect-error -- TODO: fix this */}
      <Survey
        {...props}
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
      />
    </SurveyContainer>
  );
}
