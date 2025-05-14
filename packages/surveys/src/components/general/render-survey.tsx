import { useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: SurveyContainerProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Define survey type-specific styles
  const surveyTypeStyles = {
    "--fb-survey-card-max-height": props.survey.type === "link" ? "56dvh" : "25dvh",
    "--fb-survey-card-min-height": props.survey.type === "link" ? "0dvh" : "25dvh",
  } as React.CSSProperties;

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (props.onClose) {
        props.onClose();
      }
    }, 1000); // wait for animation to finish}
  };

  return (
    <SurveyContainer
      mode={props.mode ?? "modal"}
      placement={props.placement}
      darkOverlay={props.darkOverlay}
      clickOutside={props.clickOutside}
      onClose={close}
      isOpen={isOpen}
      style={surveyTypeStyles}>
      {/* @ts-expect-error -- TODO: fix this */}
      <Survey
        {...props}
        clickOutside={props.placement === "center" ? props.clickOutside : true}
        onClose={close}
        onFinished={() => {
          props.onFinished?.();

          if (props.mode !== "inline") {
            setTimeout(
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
