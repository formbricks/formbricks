import { SubmitButton } from "@/components/buttons/submit-button";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { replaceRecallInfo } from "@/lib/recall";
import { calculateElementIdx } from "@/lib/utils";
import { useEffect } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc, type TResponseVariables } from "@formbricks/types/responses";
import { type TI18nString } from "@formbricks/types/surveys/types";
import { Headline } from "./headline";
import { HtmlBody } from "./html-body";

interface WelcomeCardProps {
  headline?: TI18nString;
  html?: TI18nString;
  fileUrl?: string;
  buttonLabel?: TI18nString;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  survey: TJsEnvironmentStateSurvey;
  languageCode: string;
  responseCount?: number;
  autoFocusEnabled: boolean;
  isCurrent: boolean;
  responseData: TResponseData;
  variablesData: TResponseVariables;
}

function TimerIcon() {
  return (
    <div className="fb:mr-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
        className="bi bi-stopwatch"
        viewBox="0 0 16 16">
        <path d="M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5V5.6z" />
        <path d="M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64a.715.715 0 0 1 .012-.013l.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354a.512.512 0 0 1-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5zM8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3z" />
      </svg>
    </div>
  );
}

function UsersIcon() {
  return (
    <div className="fb:mr-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="fb:h-4 fb:w-4">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    </div>
  );
}

export function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  onSubmit,
  languageCode,
  survey,
  responseCount,
  autoFocusEnabled,
  isCurrent,
  responseData,
  variablesData,
}: WelcomeCardProps) {
  const calculateTimeToComplete = () => {
    let totalCards = survey.questions.length;
    if (survey.endings.length > 0) totalCards += 1;
    let idx = calculateElementIdx(survey, 0, totalCards);
    if (idx === 0.5) {
      idx = 1;
    }
    const timeInSeconds = (survey.questions.length / idx) * 15; //15 seconds per question.
    if (timeInSeconds > 360) {
      // If it's more than 6 minutes
      return "6+ minutes";
    }
    // Calculate minutes, if there are any seconds left, add a minute
    const minutes = Math.floor(timeInSeconds / 60);
    const remainingSeconds = timeInSeconds % 60;

    if (remainingSeconds > 0) {
      // If there are any seconds left, we'll need to round up to the next minute
      if (minutes === 0) {
        // If less than 1 minute, return 'less than 1 minute'
        return "less than 1 minute";
      }
      // If more than 1 minute, return 'less than X minutes', where X is minutes + 1
      return `less than ${(minutes + 1).toString()} minutes`;
    }
    // If there are no remaining seconds, just return the number of minutes
    return `${minutes.toString()} minutes`;
  };

  const timeToFinish = survey.welcomeCard.timeToFinish;
  const showResponseCount = survey.welcomeCard.showResponseCount;

  const handleSubmit = () => {
    onSubmit({ welcomeCard: "clicked" }, {});
  };

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    };

    if (isCurrent && survey.type === "link") {
      document.addEventListener("keydown", handleEnter);
    } else {
      document.removeEventListener("keydown", handleEnter);
    }

    return () => {
      document.removeEventListener("keydown", handleEnter);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps -- only want to run this effect when isCurrent changes
  }, [isCurrent]);

  return (
    <div>
      <ScrollableContainer>
        <div>
          {fileUrl ? (
            <img
              src={fileUrl}
              className="fb:mb-8 fb:max-h-96 fb:w-1/4 fb:rounded-lg fb:object-contain"
              alt="Company Logo"
            />
          ) : null}

          <Headline
            headline={replaceRecallInfo(
              getLocalizedValue(headline, languageCode),
              responseData,
              variablesData
            )}
            questionId="welcomeCard"
          />
          <HtmlBody
            htmlString={replaceRecallInfo(getLocalizedValue(html, languageCode), responseData, variablesData)}
            questionId="welcomeCard"
          />
        </div>
      </ScrollableContainer>
      <div className="fb:mx-6 fb:mt-4 fb:flex fb:gap-4 fb:py-4">
        <SubmitButton
          buttonLabel={getLocalizedValue(buttonLabel, languageCode)}
          isLastQuestion={false}
          focus={isCurrent ? autoFocusEnabled : false}
          tabIndex={isCurrent ? 0 : -1}
          onClick={handleSubmit}
          type="button"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
        />
      </div>
      {timeToFinish && !showResponseCount ? (
        <div className="fb:items-center fb:text-subheading fb:my-4 fb:ml-6 fb:flex">
          <TimerIcon />
          <p className="fb:pt-1 fb:text-xs">
            <span> Takes {calculateTimeToComplete()} </span>
          </p>
        </div>
      ) : null}
      {showResponseCount && !timeToFinish && responseCount && responseCount > 3 ? (
        <div className="fb:items-center fb:text-subheading fb:my-4 fb:ml-6 fb:flex">
          <UsersIcon />
          <p className="fb:pt-1 fb:text-xs">
            <span>{`${responseCount.toString()} people responded`}</span>
          </p>
        </div>
      ) : null}
      {timeToFinish && showResponseCount ? (
        <div className="fb:items-center fb:text-subheading fb:my-4 fb:ml-6 fb:flex">
          <TimerIcon />
          <p className="fb:pt-1 fb:text-xs">
            <span> Takes {calculateTimeToComplete()} </span>
            <span>
              {responseCount && responseCount > 3 ? `⋅ ${responseCount.toString()} people responded` : ""}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
