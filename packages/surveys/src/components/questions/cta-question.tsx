import { useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { LinkIcon } from "@/components/icons/link-icon";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface CTAQuestionProps {
  question: TSurveyCTAElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: string;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
}

export function CTAQuestion({
  question,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  onOpenExternalURL,
}: Readonly<CTAQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleExternalButtonClick = () => {
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({ [question.id]: "clicked" });

    if (question.buttonUrl) {
      if (onOpenExternalURL) {
        onOpenExternalURL(question.buttonUrl);
      } else {
        window.open(question.buttonUrl, "_blank")?.focus();
      }
    }
  };

  return (
    <div key={question.id}>
      <div>
        {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(question.headline, languageCode)}
          questionId={question.id}
          required={true}
        />
        <Subheader
          subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
          questionId={question.id}
        />
        {question.buttonExternal && question.buttonUrl && (
          <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-pt-4">
            <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-start">
              <button
                dir="auto"
                type="button"
                tabIndex={isCurrent ? 0 : -1}
                onClick={handleExternalButtonClick}
                className="fb-text-heading focus:fb-ring-focus fb-flex fb-items-center fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2">
                {getLocalizedValue(question.ctaButtonLabel, languageCode)}
                <LinkIcon className="fb-ml-2 fb-h-4 fb-w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
