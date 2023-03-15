export default function SummaryMetadata() {
  return (
    <div className="mb-4 grid grid-cols-3 gap-x-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Total Responses</p>
        <p className="text-2xl font-bold text-slate-800">29</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Response Rate</p>
        <p className="text-2xl font-bold text-slate-800">43.4%</p>
      </div>
    </div>
  );
}
