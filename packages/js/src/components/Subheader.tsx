import { h } from "preact";

export default function Subheader({ subheader, questionId }: { subheader: string; questionId: string }) {
  return (
    <label for={questionId} class="block text-sm font-normal leading-6 text-slate-600">
      {subheader}
    </label>
  );
}
