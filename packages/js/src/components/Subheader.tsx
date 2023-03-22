import { h } from "preact";

export default function Subheader({ subheader, questionId }: { subheader?: string; questionId: string }) {
  return (
    <label for={questionId} className="fb-block fb-text-sm fb-font-normal fb-leading-6 text-slate-600">
      {subheader}
    </label>
  );
}
