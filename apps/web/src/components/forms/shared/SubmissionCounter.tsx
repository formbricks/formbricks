import { RectangleStackIcon } from "@heroicons/react/24/solid";

export function SubmissionCounter({ numFilteredSubmissions, numTotalSubmissions }) {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 px-4 py-2">
      <div className="flex items-center text-base font-semibold text-slate-500">
        <RectangleStackIcon className="mr-2 h-5 w-5 text-slate-300" /> {numFilteredSubmissions} responses
        {numFilteredSubmissions !== numTotalSubmissions && (
          <div className="ml-2 text-sm font-medium text-slate-400">(out of {numTotalSubmissions})</div>
        )}
      </div>
    </div>
  );
}
