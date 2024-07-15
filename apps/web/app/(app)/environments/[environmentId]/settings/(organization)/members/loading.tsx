import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <div
      data-testid="members-loading-card"
      className="my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-6">
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

const cards = [
  {
    title: "Manage members",
    description: "Add or remove members in your organization.",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }, { classes: "h-8 w-80" }],
  },
  {
    title: "Organization Name",
    description: "Give your organization a descriptive name.",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
  },
  {
    title: "Delete Organization",
    description:
      "Delete organization with all its products including all surveys, responses, people, actions and attributes",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
  },
];

const pages = ["Members", IS_FORMBRICKS_CLOUD ? "Billing & Plan" : "Enterprise License"];

const Loading = () => {
  return (
    <div className="p-6">
      <div>
        <div className="flex items-center justify-between space-x-4 pb-4">
          <h1 className="text-3xl font-bold text-slate-800">Organization Settings</h1>
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
