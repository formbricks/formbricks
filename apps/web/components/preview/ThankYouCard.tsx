import Headline from "./Headline";
import Subheader from "./Subheader";
import RedirectCountDown from "./RedirectCountDown";

interface ThankYouCardProps {
  headline: string;
  subheader: string;
  brandColor: string;
  initiateCountdown?: boolean;
}

export default function ThankYouCard({
  headline,
  subheader,
  brandColor,
  initiateCountdown,
}: ThankYouCardProps) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center" style={{ color: brandColor }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="h-24 w-24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <span className="mb-[10px] inline-block h-1 w-16 rounded-[100%] bg-slate-300"></span>

      <div>
        <Headline headline={headline} questionId="thankYouCard" />
        <Subheader subheader={subheader} questionId="thankYouCard" />
        <RedirectCountDown initiateCountdown={initiateCountdown} />
      </div>
    </div>
  );
}
