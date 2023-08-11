function LoadingCard({ title, description }) {
  return (
    <div className="my-4 rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-100 px-6 py-5 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-6 py-5 hover:bg-slate-100">
          <div className="flex justify-end">
            <div className="mt-4  h-6 w-28 animate-pulse rounded-full bg-gray-200"></div>
          </div>
          <div className="mt-6 rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-9 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2">Label</div>
              <div className="col-span-2">API Key</div>
              <div className="col-span-2">Last used</div>
              <div className="col-span-2">Created at</div>
            </div>
            <div className="px-6">
              <div className="my-4 h-6 w-full animate-pulse rounded-full bg-gray-200"></div>
              <div className="my-4 h-6 w-full animate-pulse rounded-full bg-gray-200"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Loading() {
  const cards = [
    {
      title: "Development Env Keys",
      description: "Add and remove API keys for your Development environment.",
    },
    {
      title: "Production Env Keys",
      description: "Add and remove API keys for your Production environment.",
    },
  ];

  return (
    <div>
      <h2 className="my-4 text-2xl font-medium leading-6 text-slate-800">API Keys</h2>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </div>
  );
}
