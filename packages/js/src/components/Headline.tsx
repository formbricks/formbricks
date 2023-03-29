import { h } from "preact";

export default function Headline({ headline, questionId }: { headline: string; questionId: string }) {
  return (
    <label
      htmlFor={questionId}
      className="fb-block fb-text-base fb-font-semibold fb-leading-6 fb-mr-8 text-slate-900">
      {headline}
    </label>
  );
}
