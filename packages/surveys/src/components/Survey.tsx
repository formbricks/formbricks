import type { TResponseData } from "@formbricks/types/v1/responses";
import { useEffect, useRef, useState } from "preact/hooks";
import { evaluateCondition } from "../lib/logicEvaluator";
import { cn } from "../lib/utils";
import { SurveyBaseProps } from "../types/props";
import { AutoCloseWrapper } from "./AutoCloseWrapper";
import FormbricksSignature from "./FormbricksSignature";
import ProgressBar from "./ProgressBar";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";

export function Survey({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  isRedirectDisabled = false,
  prefillResponseData,
}: SurveyBaseProps) {
  const [questionId, setQuestionId] = useState(activeQuestionId || survey.questions[0]?.id);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>({});
  const currentQuestionIndex = survey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = survey.questions[currentQuestionIndex];
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [dpOpen, setDpOpen] = useState(false);
  useEffect(() => {
    setQuestionId(activeQuestionId || survey.questions[0].id);
  }, [activeQuestionId, survey.questions]);

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  // call onDisplay when component is mounted
  useEffect(() => {
    onDisplay();
    if (prefillResponseData) {
      onSubmit(prefillResponseData);
    }
  }, []);

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!dpOpen) return;

    // @ts-ignore
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src =
        "https://super-test-bucket-pandeyman.s3.ap-south-1.amazonaws.com/index-285bde5a.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEN7%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiRjBEAiBvYWF0w6XdKaaXGHEyOpxoXbcjWkjkoz%2F9489DnzLfjwIgI6JSzUGHA%2BHe%2Bxb52uPoOkankC%2BwDuRjvCEdUQ2nJQYq7QII5%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgw1NzY3NzU0Mzg2MjUiDOuV0zNXWYMPVfB7VSrBApOiJxl01Ndgd1VH0rQPY9fGM%2BncIZ%2FJ%2F5lOiOjqzju0xDn6Jsax%2FuN8xnkGXmgxgNDhUyzR04JUTaGJM3TsSpN4QfuCB9jz8zW6GvA81%2BwbzL2iICB9BxmVaCKxhu7vl378NolC3j99wPFMyJTKqmv4AtHD8N3XRkzqdxWg%2BXMS28e0cLP2m1qVjQMm5GMNntcCz6pu%2F%2BaJ4Cm9lQifZozCMbrNOMNmDDhf1pg5LiA1YNMf44c57yoG5dC11fC7nEjsc71ba%2B%2Fw97lPCSSFHCMwsBsVTcIP3AZ80PnTDtftGiYo2RDBh5%2Bv9NyuA2EkbshYDRUJsYhkv1tDtItEC%2BKVQEkHagQsGjdSVl88Y4SgxG0pnRLk4vNWFaNnJFOtk%2F2HU3ZU5vgknnYBg576aCQu5MbqFWyA05sSa7GwGliXaTDb95ipBjq0AvD46PRSQ4KCC5CCH9I03s%2F24kWIg6ezty1cOSyr7%2BOVK4wsBHED7GHoEJod%2BExALrfIes74VdwjEFhi1Km5uDSlyA81p4iYDQ4cNPkh6fyJFiX%2B1x23OaW2rFjLIoKMK4v6qV10SM4ZnSdkama6xChB9ukmjBo3FC9P9p3p6BmrphARkqenzolJQ3ZDD72K6ElewjuJDKDq4sDv%2BADd69CXcCf9a9tLgvsdHIP5N2gxxsBEsUeovhjWmsPZuEUtdshU%2F%2FQMYC0bTvbe6YaSe2jkyY4Qax2WWN8wlVaN1UanRjiif%2FRugiGhPVsOmb7M45XkoPQROfkrtYgu5%2FeNvFYBOeSuDz%2FIlMbH9tOCsspkwSB%2BNuvGZsYFj%2B6BQisy%2BfGLrZxOOW9PoVoN4tl8jnLUUcxX&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20231011T090514Z&X-Amz-SignedHeaders=host&X-Amz-Expires=7200&X-Amz-Credential=ASIAYMST6YEQVDLKXX7S%2F20231011%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=8f18737f916dce7a6e6d8508643dc4466870c93c5fc9e9d78e9bb25230900c71";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-ignore
        window.initDatePicker(document.getElementById("date-pick"));
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, just initialize
      // @ts-ignore
      window.initDatePicker(document.getElementById("date-pick"));
    }

    return () => {};
  }, [dpOpen]);

  function getNextQuestionId(data: TResponseData): string {
    const questions = survey.questions;
    const responseValue = data[questionId];

    if (currentQuestionIndex === -1) throw new Error("Question not found");

    if (currentQuestion?.logic && currentQuestion?.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, responseValue)) {
          return logic.destination;
        }
      }
    }
    return questions[currentQuestionIndex + 1]?.id || "end";
  }

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData);
    const finished = nextQuestionId === "end";
    onResponse({ data: responseData, finished });
    if (finished) {
      onFinished();
    }
    setQuestionId(nextQuestionId);
    // add to history
    setHistory([...history, questionId]);
    setLoadingElement(false);
    onActiveQuestionChange(nextQuestionId);
  };

  const onBack = (): void => {
    let prevQuestionId;
    // use history if available
    if (history?.length > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      if (prefillResponseData && prevQuestionId === survey.questions[0].id) return;
      setHistory(newHistory);
    } else {
      // otherwise go back to previous question in array
      prevQuestionId = survey.questions[currentQuestionIndex - 1]?.id;
    }
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };

  return (
    <>
      <AutoCloseWrapper survey={survey} brandColor={brandColor} onClose={onClose}>
        <div className="flex h-full w-full flex-col justify-between bg-white px-6 pb-3 pt-6">
          <div ref={contentRef} className={cn(loadingElement ? "animate-pulse opacity-60" : "", "my-auto")}>
            {questionId === "end" && survey.thankYouCard.enabled ? (
              <ThankYouCard
                headline={survey.thankYouCard.headline}
                subheader={survey.thankYouCard.subheader}
                brandColor={brandColor}
                redirectUrl={survey.redirectUrl}
                isRedirectDisabled={isRedirectDisabled}
              />
            ) : (
              survey.questions.map(
                (question, idx) =>
                  questionId === question.id && (
                    <QuestionConditional
                      question={question}
                      value={responseData[question.id]}
                      onChange={onChange}
                      onSubmit={onSubmit}
                      onBack={onBack}
                      isFirstQuestion={
                        // if prefillResponseData is provided, check if we're on the first "real" question
                        history && prefillResponseData
                          ? history[history.length - 1] === survey.questions[0].id
                          : idx === 0
                      }
                      isLastQuestion={idx === survey.questions.length - 1}
                      brandColor={brandColor}
                    />
                  )
              )
            )}
          </div>
          <div className="mt-8">
            {formbricksSignature && <FormbricksSignature />}
            <ProgressBar survey={survey} questionId={questionId} brandColor={brandColor} />
          </div>
        </div>
      </AutoCloseWrapper>
    </>
  );
}
