const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <div className="my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-6 py-5">
          {skeletonLines.map((line, index) => (
            <div key={index} className="mt-4">
              <div className={`animate-pulse rounded-full bg-slate-200 ${line.classes}`}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Loading = () => {
  const cards = [
    {
      title: "Personal information",
      description: "Update your personal information",
      skeletonLines: [
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
      ],
    },
    {
      title: "Avatar",
      description: "Assist your organization in identifying you on Formbricks.",
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

  const pages = ["Profile", "Notifications"];

  return (
    <div className="p-6">
      <div>
        <div className="flex items-center justify-between space-x-4 pb-4">
          <h1 className="text-3xl font-bold text-slate-800">Account Settings</h1>
        </div>
      </div>
      <div className="mb-6 border-b border-slate-200">
        <div className="grid h-10 w-full grid-cols-[auto,1fr]">
          <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
            {pages.map((navElem) => (
              <div
                key={navElem}
                className="flex h-full items-center border-b-2 border-transparent px-3 text-sm font-medium text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700">
                {navElem}
              </div>
            ))}
          </nav>
          <div className="justify-self-end"></div>
        </div>
      </div>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </div>
  );
};

export default Loading;
