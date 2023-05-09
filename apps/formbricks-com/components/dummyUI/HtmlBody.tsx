import { cleanHtml } from "../../lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString: string; questionId: string }) {
  return (
    <label
      htmlFor={questionId}
      className="fb-block fb-font-normal fb-leading-6 text-sm text-slate-500"
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
