import { h } from "preact";
import { useEffect, useState } from "preact/compat";
import { createResponse, updateResponse } from "../lib/response";
import { cn } from "../lib/utils";
import OpenTextQuestion from "./OpenTextQuestion";
import Progress from "./Progress";
import RadioElement from "./RadioElement";

export default function SurveyView({ config, survey, close }) {
  const [currentQuestion, setCurrentQuestion] = useState(survey.questions[0]);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [responseId, setResponseId] = useState(null);
  const [loadingElement, setLoadingElement] = useState(false);

  useEffect(() => {
    setProgress(calculateProgress());

    function calculateProgress() {
      const elementIdx = survey.questions.findIndex((e) => e.name === currentQuestion.name);
      return elementIdx / survey.questions.length;
    }
  }, [currentQuestion, survey]);

  const submitQuestion = async (data: { [x: string]: any }) => {
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
      const response = await createResponse(responseRequest, config);
      setResponseId(response.id);
    } else {
      await updateResponse(responseRequest, responseId, config);
    }
    setLoadingElement(false);
    if (!finished) {
      setCurrentQuestion(survey.questions[questionIdx + 1]);
    } else {
      close();
    }
  };

  return (
    <div>
      <div className={cn(loadingElement ? "animate-pulse opacity-60" : "", "p-4")}>
        {currentQuestion.type === "radio" ? (
          <RadioElement element={currentQuestion} onSubmit={submitQuestion} />
        ) : currentQuestion.type === "openText" ? (
          <OpenTextQuestion
            question={currentQuestion}
            onSubmit={submitQuestion}
            lastQuestion={
              survey.questions.findIndex((e) => e.id === currentQuestion.id) === survey.questions.length - 1
            }
          />
        ) : null}
      </div>
      <div className="mt-2">
        <Progress progress={progress} />
      </div>
    </div>
  );
}
