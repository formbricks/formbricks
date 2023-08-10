import { cleanHtml } from "../lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString?: string; questionId: string }) {
  if (!htmlString) return null;
  return (
    <label
      htmlFor={questionId}
      className="fb-block fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600"
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
