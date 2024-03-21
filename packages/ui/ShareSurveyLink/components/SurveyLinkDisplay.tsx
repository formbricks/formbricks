import { useRef } from "react";

interface SurveyLinkDisplayProps {
  surveyUrl: string;
}

export const SurveyLinkDisplay = ({ surveyUrl }: SurveyLinkDisplayProps) => {
  const linkTextRef = useRef(null);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <div
      className="mt-2 max-w-[80%] overflow-hidden rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800"
      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      onClick={handleTextSelection}>
      {surveyUrl}
    </div>
  );
};
