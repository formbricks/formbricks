import { TSurveyClosedMessage } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { CheckCircleIcon, PauseCircleIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import footerLogo from "./footerlogo.svg";

const SurveyInactive = ({
  status,
  surveyClosedMessage,
}: {
  status: "paused" | "completed" | "link invalid";
  surveyClosedMessage?: TSurveyClosedMessage | null;
}) => {
  const icons = {
    paused: <PauseCircleIcon className="h-20 w-20" />,
    completed: <CheckCircleIcon className="h-20 w-20" />,
    "link invalid": <QuestionMarkCircleIcon className="h-20 w-20" />,
  };

  const descriptions = {
    paused: "This free & open-source survey is temporarily paused.",
    completed: "This free & open-source survey has been closed.",
    "link invalid": "This survey can only be taken by invitation.",
  };

  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-br from-slate-200 to-slate-50 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        {icons[status]}
        <h1 className="text-4xl font-bold text-slate-800">
          {status === "completed" && surveyClosedMessage ? surveyClosedMessage.heading : `Survey ${status}.`}
        </h1>
        <p className="text-lg leading-10 text-gray-500">
          {status === "completed" && surveyClosedMessage
            ? surveyClosedMessage.subheading
            : descriptions[status]}
        </p>
        {!(status === "completed" && surveyClosedMessage) && status !== "link invalid" && (
          <Button variant="darkCTA" className="mt-2" href="https://formbricks.com">
            Create your own
          </Button>
        )}
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};

export default SurveyInactive;
