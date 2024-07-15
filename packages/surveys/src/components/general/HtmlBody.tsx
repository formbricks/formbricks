import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface HtmlBodyProps {
  htmlString?: string;
  questionId: string;
}

export const HtmlBody = ({ htmlString, questionId }: HtmlBodyProps) => {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      import("isomorphic-dompurify").then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(htmlString, { ADD_ATTR: ["target"] }));
      });
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;

  return (
    <label
      htmlFor={questionId}
      className={cn("fb-htmlbody fb-break-words")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
};
