import { cn } from "@/../../packages/lib/cn";
import { isLight } from "@/lib/utils";

function SubmitButton({ question, lastQuestion, brandColor }) {
  return (
    <button
      type="submit"
      className={cn(
        "flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
        isLight(brandColor) ? "text-black" : "text-white"
      )}
      style={{ backgroundColor: brandColor }}>
      {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
    </button>
  );
}
export default SubmitButton;
