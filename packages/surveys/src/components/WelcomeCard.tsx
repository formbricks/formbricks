import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

interface WelcomeCardProps {
  headline?: string;
  html?: string;
  fileUrl?: string;
  buttonLabel?: string;
  timeToFinish?: boolean;
  brandColor: string;
  onSubmit: (data: { [x: string]: any }) => void;
}

export default function WelcomeCard({
  headline,
  html,
  fileUrl,
  buttonLabel,
  timeToFinish,
  brandColor,
  onSubmit,
}: WelcomeCardProps) {
  console.log(buttonLabel);
  console.log(timeToFinish);
  console.log(brandColor);
  return (
    <div>
      {fileUrl && (
        <img src={fileUrl} className="max-w-1/3 mb-8 max-h-96 rounded-lg object-contain" alt="Company Logo" />
      )}

      <Headline headline={headline} questionId="welcomeCard" />
      <HtmlBody htmlString={html} questionId="welcomeCard" />

      <div className="mt-10 flex w-full justify-between">
        <div className="flex w-full justify-start gap-4">
          <SubmitButton
            buttonLabel={buttonLabel}
            isLastQuestion={false}
            brandColor={brandColor}
            focus={true}
            onClick={() => {
              onSubmit({ ["welcomeCard"]: "clicked" });
            }}
            type="button"
          />
          <div className="flex items-center text-xs text-slate-600">Press Enter ↵</div>
        </div>
      </div>
    </div>
  );
}
