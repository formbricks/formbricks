export default function GoogleTagTableHeading() {
  return (
    <>
      <div className="grid h-12 grid-cols-12 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <span className="sr-only">Edit</span>
        <div className="col-span-3 pl-6">Google Tag</div>
        <div className="col-span-4 text-center">Surveys</div>
        <div className="col-span-2 text-center">Updated At</div>
        <div className="col-span-2 text-center">Created At</div>
      </div>
    </>
  );
}
