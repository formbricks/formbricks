import { useEffect, useState } from "preact/hooks";
// import { Suspense, lazy } from "preact/compat";
import { SurveyModalProps } from "../types/props";
import Modal from "./Modal";
import { Survey } from "./Survey";
// import { DayPicker } from "react-day-picker";
// import "react-day-picker/dist/style.css";

// const DatePicker = lazy(() => import("react-day-picker").then((comp) => comp.DayPicker)) as any;

export function SurveyModal({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  placement,
  clickOutside,
  darkOverlay,
  highlightBorderColor,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  isRedirectDisabled = false,
}: SurveyModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [dpOpen, setDpOpen] = useState(false);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      onClose();
    }, 1000); // wait for animation to finish}
  };

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!dpOpen) return;

    // @ts-ignore
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://super-test-bucket-pandeyman.s3.ap-south-1.amazonaws.com/index-0f8350d4.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEN7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiRjBEAiBvYWF0w6XdKaaXGHEyOpxoXbcjWkjkoz%2F9489DnzLfjwIgI6JSzUGHA%2BHe%2Bxb52uPoOkankC%2BwDuRjvCEdUQ2nJQYq7QII5%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgw1NzY3NzU0Mzg2MjUiDOuV0zNXWYMPVfB7VSrBApOiJxl01Ndgd1VH0rQPY9fGM%2BncIZ%2FJ%2F5lOiOjqzju0xDn6Jsax%2FuN8xnkGXmgxgNDhUyzR04JUTaGJM3TsSpN4QfuCB9jz8zW6GvA81%2BwbzL2iICB9BxmVaCKxhu7vl378NolC3j99wPFMyJTKqmv4AtHD8N3XRkzqdxWg%2BXMS28e0cLP2m1qVjQMm5GMNntcCz6pu%2F%2BaJ4Cm9lQifZozCMbrNOMNmDDhf1pg5LiA1YNMf44c57yoG5dC11fC7nEjsc71ba%2B%2Fw97lPCSSFHCMwsBsVTcIP3AZ80PnTDtftGiYo2RDBh5%2Bv9NyuA2EkbshYDRUJsYhkv1tDtItEC%2BKVQEkHagQsGjdSVl88Y4SgxG0pnRLk4vNWFaNnJFOtk%2F2HU3ZU5vgknnYBg576aCQu5MbqFWyA05sSa7GwGliXaTDb95ipBjq0AvD46PRSQ4KCC5CCH9I03s%2F24kWIg6ezty1cOSyr7%2BOVK4wsBHED7GHoEJod%2BExALrfIes74VdwjEFhi1Km5uDSlyA81p4iYDQ4cNPkh6fyJFiX%2B1x23OaW2rFjLIoKMK4v6qV10SM4ZnSdkama6xChB9ukmjBo3FC9P9p3p6BmrphARkqenzolJQ3ZDD72K6ElewjuJDKDq4sDv%2BADd69CXcCf9a9tLgvsdHIP5N2gxxsBEsUeovhjWmsPZuEUtdshU%2F%2FQMYC0bTvbe6YaSe2jkyY4Qax2WWN8wlVaN1UanRjiif%2FRugiGhPVsOmb7M45XkoPQROfkrtYgu5%2FeNvFYBOeSuDz%2FIlMbH9tOCsspkwSB%2BNuvGZsYFj%2B6BQisy%2BfGLrZxOOW9PoVoN4tl8jnLUUcxX&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231011T072752Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIAYMST6YEQVDLKXX7S%2F20231011%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=a9a4bcce6c63f77426b05edd342fd8ae1619ed1fce92e9850b4ee5757c27f224";
      script.async = true;

      document.body.appendChild(script);

      console.log("script", script);
      console.log("window: ", window);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-ignore
        window.initDatePicker();
      };

      // document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, just initialize
      // @ts-ignore
      window.initDatePicker();
    }

    return () => {};
  }, [dpOpen]);

  return (
    <div id="fbjs">
      <Modal
        placement={placement}
        clickOutside={clickOutside}
        darkOverlay={darkOverlay}
        highlightBorderColor={highlightBorderColor}
        isOpen={isOpen}
        onClose={close}>
        <>
          <div>
            <button
              onClick={() => {
                setDpOpen(!dpOpen);
              }}>
              Open DP
            </button>

            {/* {dpOpen && <DayPicker />} */}
            {/* {dpOpen && (
              <Suspense fallback={<div>Loading...</div>}>
                <DatePicker />
              </Suspense>
            )} */}
          </div>
          <Survey
            survey={survey}
            brandColor={brandColor}
            formbricksSignature={formbricksSignature}
            activeQuestionId={activeQuestionId}
            onDisplay={onDisplay}
            onActiveQuestionChange={onActiveQuestionChange}
            onResponse={onResponse}
            onClose={onClose}
            onFinished={() => {
              onFinished();
              setTimeout(() => {
                if (!survey.redirectUrl) {
                  close();
                }
              }, 4000); // close modal automatically after 4 seconds
            }}
            isRedirectDisabled={isRedirectDisabled}
          />
        </>
      </Modal>
    </div>
  );
}
