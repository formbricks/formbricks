import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface HtmlBodyProps {
  htmlString?: string;
  questionId: string;
  isRtl?: boolean;
}

export const HtmlBody = ({ htmlString, questionId, isRtl = false }: HtmlBodyProps) => {
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
      className={cn("fb-htmlbody break-words", isRtl ? "rtl" : "")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};
