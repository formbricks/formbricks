import { useEffect, useState } from "react";

interface HtmlBodyProps {
  htmlString: string | undefined;
  questionId: string;
}

export default function HtmlBody({ htmlString, questionId }: HtmlBodyProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      import("dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(htmlString));
      });
    }
  }, [htmlString]);

  if (!htmlString) return null;

  return (
    <label
      htmlFor={questionId}
      className="fb-htmlbody" // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}></label>
  );
}
