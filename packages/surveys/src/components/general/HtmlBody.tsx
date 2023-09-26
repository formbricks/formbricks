import { cleanHtml } from "../../lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString?: string; questionId: string }) {
  if (!htmlString) return null;
  return (
    <label
      htmlFor={questionId}
      className="block text-sm font-normal leading-6 text-slate-600"
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
