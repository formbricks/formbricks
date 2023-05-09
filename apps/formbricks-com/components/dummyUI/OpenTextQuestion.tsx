import type { OpenTextQuestion } from "./questionTypes";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface OpenTextQuestionProps {
  question: OpenTextQuestion;
  onSubmit: (id: string) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: OpenTextQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = "Pupsi";
        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <textarea
          rows={3}
          name={question.id}
          id={question.id}
          placeholder={question.placeholder}
          required={question.required}
          className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 dark:bg-slate-500 dark:text-white sm:text-sm"></textarea>
      </div>
      <div className="mt-4 flex w-full justify-between">
        <div></div>
        <button
          type="submit"
          className="flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
