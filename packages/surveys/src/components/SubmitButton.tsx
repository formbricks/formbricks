import { h } from "preact";

import { cn } from "@/../../packages/lib/cn";
import { isLight } from "../lib/utils";

function SubmitButton({ question, lastQuestion, brandColor, onClick, type = "submit" }) {
  return (
    <button
      type={type}
      className={cn(
        "fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2",
        isLight(brandColor) ? "fb-text-black" : "fb-text-white"
      )}
      style={{ backgroundColor: brandColor }}
      onClick={onClick}>
      {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
    </button>
  );
}
export default SubmitButton;
