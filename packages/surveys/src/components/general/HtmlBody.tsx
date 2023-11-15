import { cleanHtml } from "@/lib/cleanHtml";

export default function HtmlBody({ htmlString, questionId }: { htmlString?: string; questionId: string }) {
  if (!htmlString) return null;
  return (
    <label
      htmlFor={questionId}
      className="fb-htmlbody" // styles are in global.css
      dangerouslySetInnerHTML={{ __html: cleanHtml(htmlString) }}></label>
  );
}
