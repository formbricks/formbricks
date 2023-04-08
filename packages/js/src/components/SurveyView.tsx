import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { createDisplay, markDisplayResponded } from "../lib/display";
import { createResponse, updateResponse } from "../lib/response";
import { cn } from "../lib/utils";
import { JsConfig, Survey } from "@formbricks/types/js";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import Progress from "./Progress";
import ThankYouCard from "./ThankYouCard";

interface SurveyViewProps {
  config: JsConfig;
  survey: Survey;
  close: () => void;
  brandColor: string;
}

export default function SurveyView({ config, survey, close, brandColor }: SurveyViewProps) {
  const [currentQuestion, setCurrentQuestion] = useState(survey.questions[0]);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [responseId, setResponseId] = useState(null);
  const [displayId, setDisplayId] = useState(null);
  const [loadingElement, setLoadingElement] = useState(false);

  useEffect(() => {
    initDisplay();
    async function initDisplay() {
      const displayId = await createDisplay({ surveyId: survey.id, personId: config.person.id }, config);
      setDisplayId(displayId.id);
    }
  }, [config, survey]);

  useEffect(() => {
    setProgress(calculateProgress());

    function calculateProgress() {
      const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
      return elementIdx / survey.questions.length;
    }
  }, [currentQuestion, survey]);

  const submitResponse = async (data: { [x: string]: any }) => {
    setLoadingElement(true);
    const questionIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
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
      setResponseId(response.id);
    } else {
      await updateResponse(responseRequest, responseId, config);
    }
    setLoadingElement(false);
    if (!finished) {
      setCurrentQuestion(survey.questions[questionIdx + 1]);
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
          "fb-p-4 fb-text-slate-800 fb-font-sans"
        )}>
        {progress === 100 && survey.thankYouCard.enabled ? (
          <ThankYouCard
            headline={survey.thankYouCard.headline}
            subheader={survey.thankYouCard.subheader}
            brandColor={config.settings?.brandColor}
          />
        ) : currentQuestion.type === "multipleChoiceSingle" ? (
          <MultipleChoiceSingleQuestion
            question={currentQuestion}
            onSubmit={submitResponse}
            lastQuestion={
              survey.questions.findIndex((e) => e.id === currentQuestion.id) === survey.questions.length - 1
            }
            brandColor={brandColor}
          />
        ) : currentQuestion.type === "openText" ? (
          <OpenTextQuestion
            question={currentQuestion}
            onSubmit={submitResponse}
            lastQuestion={
              survey.questions.findIndex((e) => e.id === currentQuestion.id) === survey.questions.length - 1
            }
            brandColor={brandColor}
          />
        ) : null}
      </div>
      <div className="fb-mt-2">
        <Progress progress={progress} brandColor={brandColor} />
      </div>
    </div>
  );
}
