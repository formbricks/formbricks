import SubmitButton from "@/components/buttons/SubmitButton";
import { calculateElementIdx } from "@/lib/utils";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import Headline from "./Headline";
import HtmlBody from "./HtmlBody";

interface WelcomeCardProps {
  headline?: string;
  html?: string;
  fileUrl?: string;
  buttonLabel?: string;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  survey: TSurvey;
  responseCount?: number;
}

const TimerIcon = () => {
  return (
    <div className="mr-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
        class="bi bi-stopwatch"
        viewBox="0 0 16 16">
        <path d="M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5V5.6z" />
        <path d="M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64a.715.715 0 0 1 .012-.013l.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354a.512.512 0 0 1-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5zM8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3z" />
      </svg>
    </div>
  );
};

const UsersIcon = () => {
  return (
    <div className="mr-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="h-4 w-4">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    </div>
  );
};

export default function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  onSubmit,
  survey,
  responseCount,
}: WelcomeCardProps) {
  const calculateTimeToComplete = () => {
    let idx = calculateElementIdx(survey, 0);
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
      } else {
        // If more than 1 minute, return 'less than X minutes', where X is minutes + 1
        return `less than ${minutes + 1} minutes`;
      }
    }
    // If there are no remaining seconds, just return the number of minutes
    return `${minutes} minutes`;
  };

  const timeToFinish = survey.welcomeCard.timeToFinish;
  const showResponseCount = survey.welcomeCard.showResponseCount;

  return (
    <div>
      {fileUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={fileUrl} className="mb-8 max-h-96 w-1/3 rounded-lg object-contain" alt="Company Logo" />
      )}

      <Headline headline={headline} questionId="welcomeCard" />
      <HtmlBody htmlString={html} questionId="welcomeCard" />

      <div className="mt-10 flex w-full justify-between">
        <div className="flex w-full justify-start gap-4">
          <SubmitButton
            buttonLabel={buttonLabel}
            isLastQuestion={false}
            focus={true}
            onClick={() => {
              onSubmit({ ["welcomeCard"]: "clicked" }, {});
            }}
            type="button"
          />
          <div className="text-subheading flex items-center text-xs">Press Enter ↵</div>
        </div>
      </div>

      {timeToFinish && !showResponseCount ? (
        <div className="item-center mt-4 flex text-slate-500">
          <TimerIcon />
          <p className="pt-1 text-xs">
            <span> Takes {calculateTimeToComplete()} </span>
          </p>
        </div>
      ) : showResponseCount && !timeToFinish && responseCount && responseCount > 3 ? (
        <div className="item-center mt-4 flex text-slate-500">
          <UsersIcon />
          <p className="pt-1 text-xs">
            <span>{`${responseCount} people responded`}</span>
          </p>
        </div>
      ) : timeToFinish && showResponseCount ? (
        <div className="item-center mt-4 flex text-slate-500">
          <TimerIcon />
          <p className="pt-1 text-xs">
            <span> Takes {calculateTimeToComplete()} </span>
            <span>{responseCount && responseCount > 3 ? `⋅ ${responseCount} people responded` : ""}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
