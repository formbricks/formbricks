import { h } from "preact";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface ThankYouCardProps {
  headline: string;
  subheader: string;
  brandColor: string;
}

export default function ThankYouCard({ headline, subheader, brandColor }: ThankYouCardProps) {
  return (
    <div className="fb-text-center">
      <div className="fb-flex fb-items-center fb-justify-center" style={{ color: brandColor }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="fb-h-24 fb-w-24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <span className="fb-inline-block fb-rounded-[100%] fb-w-16 fb-h-1 fb-mb-[10px] fb-bg-slate-300"></span>

      <div>
        <Headline headline={headline} questionId="thankYouCard" style={{ "margin-right": 0 }} />
        <Subheader subheader={subheader} questionId="thankYouCard" />
      </div>

      {/* <span
        className="fb-inline-block fb-w-4/5 fb-h-[2px] fb-mt-[35px] fb-mb-[10px]"
        style={{ backgroundColor: brandColor }}></span>

      <div>
        <p className="fb-text-xs fb-text-slate-500">
          Powered by{" "}
          <b>
            <a href="https://formbricks.com" target="_blank" className="fb-hover:text-slate-700">
              Formbricks
            </a>
          </b>
        </p>
      </div> */}
    </div>
  );
}
