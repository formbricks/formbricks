import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline.tsx";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import AdExplanation from "@/components/questions/AdExplanation.tsx";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { surveyTranslations } from "@/lib/surveyTranslations.ts";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { Adsense } from "@ctrl/react-adsense";
import { useState } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import { TSurveyAdQuestion } from "@formbricks/types/surveys/types";

interface AdQuestionProps {
  question: TSurveyAdQuestion;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: string;
}

type LanguageCode = keyof typeof surveyTranslations;

// const AdSensePlaceholder = () => (
//   <div
//     style={{
//       display: 'block',
//       height: '300px',
//       width: '100%',
//       backgroundColor: '#f0f0f0',
//       border: '1px dashed #ccc',
//       textAlign: 'center',
//       lineHeight: '300px',
//       color: '#999',
//     }}
//   >
//     Ad Placeholder
//   </div>
// );

export const AdQuestion = ({
  question,
  onSubmit,
  onChange,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId,
}: AdQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const [languageKey] = useState<LanguageCode>(languageCode as LanguageCode);
  const translations = surveyTranslations[languageKey] || surveyTranslations.default;

  return (
    <div key={question.id}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline headline="Sponsored links" questionId={question.id} required={question.required} />
          <AdExplanation translations={translations} />

          <Adsense
            client="ca-pub-1574672111746393"
            slot="3700116888"
            format="auto"
            responsive="true"
            style={{ display: "block", height: "300px" }}
          />
          {/*<AdSensePlaceholder/>*/}
        </div>
      </ScrollableContainer>
      <div className="flex w-full justify-between px-6 py-4">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "" }, updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div className="flex w-full justify-end">
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
            focus={autoFocusEnabled}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "clicked" }, updatedTtcObj);
              onChange({ [question.id]: "clicked" });
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
};
