import type { JsConfig, Survey } from "../../../types/js";
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { createDisplay, markDisplayResponded } from "../lib/display";
import { IErrorHandler } from "../lib/errors";
import { Logger } from "../lib/logger";
import { createResponse, updateResponse } from "../lib/response";
import { cn } from "../lib/utils";
import Progress from "./Progress";
import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";

interface SurveyViewProps {
  config: JsConfig;
  survey: Survey;
  close: () => void;
  brandColor: string;
  errorHandler: IErrorHandler;
}

export default function SurveyView({ config, survey, close, brandColor, errorHandler }: SurveyViewProps) {
  const [activeQuestionId, setActiveQuestionId] = useState(survey.questions[0].id);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [loadingElement, setLoadingElement] = useState(false);

  useEffect(() => {
    initDisplay();
    async function initDisplay() {
      const createDisplayResult = await createDisplay(
        { surveyId: survey.id, personId: config.person.id },
        config
      );

      createDisplayResult.ok === true
        ? setDisplayId(createDisplayResult.value.id)
        : errorHandler(createDisplayResult.error);
    }
  }, [config, survey, errorHandler]);

  useEffect(() => {
    setProgress(calculateProgress());

    function calculateProgress() {
      const elementIdx = survey.questions.findIndex((e) => e.id === activeQuestionId);
      return elementIdx / survey.questions.length;
    }
  }, [activeQuestionId, survey]);

  const submitResponse = async (data: { [x: string]: any }) => {
    setLoadingElement(true);
    const questionIdx = survey.questions.findIndex((e) => e.id === activeQuestionId);
    const finished = questionIdx === survey.questions.length - 1;
    // build response
    const responseRequest = {
      surveyId: survey.id,
      personId: config.person.id,
      response: { finished, data },
    };
    if (!responseId) {
      const [response, _] = await Promise.all([
        createResponse(responseRequest, config),
        markDisplayResponded(displayId, config),
      ]);

      response.ok === true ? setResponseId(response.value.id) : errorHandler(response.error);
    } else {
      const result = await updateResponse(responseRequest, responseId, config);

      if (result.ok !== true) {
        errorHandler(result.error);
      } else if (responseRequest.response.finished) {
        Logger.getInstance().debug("Submitted response");
      }
    }
    setLoadingElement(false);
    if (!finished) {
      setActiveQuestionId(survey.questions[questionIdx + 1].id);
    } else {
      setProgress(100);

      if (survey.thankYouCard.enabled) {
        setTimeout(() => {
          close();
        }, 2000);
      } else {
        close();
      }
    }
  };

  return (
    <div>
      <div
        className={cn(
          loadingElement ? "fb-animate-pulse fb-opacity-60" : "",
          "fb-text-slate-800 fb-font-sans fb-px-4 fb-py-6 sm:fb-p-6"
        )}>
        {progress === 100 && survey.thankYouCard.enabled ? (
          <ThankYouCard
            headline={survey.thankYouCard.headline}
            subheader={survey.thankYouCard.subheader}
            brandColor={config.settings?.brandColor}
          />
        ) : (
          survey.questions.map(
            (question, idx) =>
              activeQuestionId === question.id && (
                <QuestionConditional
                  key={question.id}
                  brandColor={brandColor}
                  lastQuestion={idx === survey.questions.length - 1}
                  onSubmit={submitResponse}
                  question={question}
                />
              )
          )
        )}
      </div>
      <Progress progress={progress} brandColor={brandColor} />
    </div>
  );
}
