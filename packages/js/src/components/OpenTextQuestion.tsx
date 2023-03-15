import { h } from "preact";
import type { Question } from "../types/types";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface OpenTextQuestionProps {
  question: Question;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
}

export default function OpenTextQuestion({ question, onSubmit, lastQuestion }: OpenTextQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          [question.id]: e.currentTarget[question.id].value,
        };
        e.currentTarget[question.id].value = "";
        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div class="mt-4">
        <textarea
          rows={3}
          name={question.id}
          id={question.id}
          placeholder={question.placeholder}
          required
          className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"></textarea>
      </div>
      <div className="mt-4 flex w-full justify-between">
        <div></div>
        <button
          type="submit"
          className="flex items-center rounded-md border border-transparent bg-slate-600 px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2">
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
