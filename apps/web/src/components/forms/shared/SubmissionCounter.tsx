export function SubmissionCounter({ numFilteredSubmissions, numTotalSubmissions }) {
  return (
    <div className="shadow-sms mb-4 rounded-lg bg-white p-3">
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
