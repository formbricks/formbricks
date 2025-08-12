import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useState } from "react";

interface HtmlBodyProps {
  readonly htmlString?: string;
}

export function HtmlBody({ htmlString }: HtmlBodyProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (htmlString) {
      setSafeHtml(DOMPurify.sanitize(htmlString, { ADD_ATTR: ["target"] }));
    }
  }, [htmlString]);

  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;

  return (
    <span
      className={cn("fb-htmlbody fb-break-words")} // styles are in global.css
      dangerouslySetInnerHTML={{ __html: safeHtml }}
      dir="auto"
    />
  );
}
