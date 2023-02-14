export function SubmissionCounter({ numFilteredSubmissions, numTotalSubmissions }) {
  return (
    <div className="mb-4 rounded bg-white p-3 shadow-md">
      <div className="inline-block text-base font-bold text-slate-600">
        {numFilteredSubmissions} responses
      </div>
      {numFilteredSubmissions !== numTotalSubmissions && (
        <div className="ml-1 inline-block text-sm font-medium text-slate-400">
          (out of {numTotalSubmissions})
        </div>
      )}
    </div>
  );
}
