import { useEffect, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { SurveyContainer } from "../wrappers/survey-container";
import { Survey } from "./survey";

export function RenderSurvey(props: Readonly<SurveyContainerProps>) {
  const [isOpen, setIsOpen] = useState(true);

  // Check viewport width on mount and resize
  useEffect(() => {
    const root = document.documentElement;
    const resizeObserver = new ResizeObserver(() => {
      const isDesktop = window.innerWidth > 768;

      if (props.survey.type === "link") {
        root.style.setProperty("--fb-survey-card-max-height", isDesktop ? "56dvh" : "60dvh");
        root.style.setProperty("--fb-survey-card-min-height", isDesktop ? "0" : "42dvh");
      } else {
        root.style.setProperty("--fb-survey-card-max-height", "40dvh");
        root.style.setProperty("--fb-survey-card-min-height", "40dvh");
      }
    });

    resizeObserver.observe(document.body);

    return () => {
      resizeObserver.disconnect();
      root.style.removeProperty("--fb-survey-card-max-height");
      root.style.removeProperty("--fb-survey-card-min-height");
    };
  }, [props.survey.type]);

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
      isOpen={isOpen}>
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
