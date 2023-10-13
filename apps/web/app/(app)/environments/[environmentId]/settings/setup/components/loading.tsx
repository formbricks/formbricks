function LoadingCard({ title, description, skeletonLines }) {
  return (
    <div className="my-4 rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-100 px-6 py-5 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-6 py-5 hover:bg-slate-100">
          {skeletonLines.map((line, index) => (
            <div key={index} className="mt-4">
              <div className={`animate-pulse bg-gray-200 ${line.classes}`}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  const cards = [
    {
      title: "Widget Status",
      description: "Check if the Formbricks widget is alive and kicking.",
      skeletonLines: [{ classes: "h-32 max-w-full rounded-md" }],
    },
    {
      title: "How to setup",
      description: "Follow these steps to setup the Formbricks widget within your app",
      skeletonLines: [
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
      ],
    },
  ];

  return (
    <div>
      <h2 className="my-4 text-2xl font-medium leading-6 text-slate-800">Setup Checklist</h2>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </div>
  );
}
