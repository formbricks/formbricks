import { h } from "preact";
import { cleanHtml } from "../lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString?: string; questionId: string }) {
  return (
    <label
      htmlFor={questionId}
      className="fb-block fb-text-sm fb-font-normal fb-leading-6 text-slate-600"
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
