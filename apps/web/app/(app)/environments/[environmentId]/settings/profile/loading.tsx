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
              <div className={`animate-pulse rounded-full bg-slate-200 ${line.classes}`}></div>
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
      title: "Personal Information",
      description: "Update your personal information",
      skeletonLines: [
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-8 w-24" },
      ],
    },
    {
      title: "Avatar",
      description: "Assist your team in identifying you on Formbricks.",
      skeletonLines: [{ classes: "h-10 w-10" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Security",
      description: "Manage your password and other security settings.",
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Delete account",
      description: "Delete your account with all of your personal information and data.",
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <div>
      <h2 className="my-4 text-2xl font-medium leading-6 text-slate-800">Profile</h2>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </div>
  );
}
