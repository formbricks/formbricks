export const WebhookTableHeading = () => {
  return (
    <>
      <div className="grid h-12 grid-cols-12 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <span className="sr-only">Edit</span>
        <div className="col-span-3 pl-6">Webhook</div>
        <div className="col-span-1 text-center">Source</div>
        <div className="col-span-4 text-center">Surveys</div>
        <div className="col-span-2 text-center">Triggers</div>
        <div className="col-span-2 text-center">Updated</div>
      </div>
    </>
  );
};
