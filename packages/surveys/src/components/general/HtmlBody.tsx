import { cleanHtml } from "../../lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString?: string; questionId: string }) {
  if (!htmlString) return null;
  return (
    <label
      htmlFor={questionId}
      className="fb-htmlbody" // change the styles in global.css because otherwise they wont apply to the html inside dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
