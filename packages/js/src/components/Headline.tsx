import { h } from "preact";

export default function Headline({ headline, questionId }: { headline: string; questionId: string }) {
  return (
    <label for={questionId} class="block text-base font-semibold leading-6 text-slate-900">
      {headline}
    </label>
  );
}
