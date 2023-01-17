import clsx from "clsx";

const BestPractices = [
  {
    title: "Onboarding Segmentation",
    description:
      "Get to know your users right from the start. Ask a few questions early, let us enrich the profile.",
    category: "In-Moment",
    icon: "",
  },
  {
    title: "Superhuman PMF Engine",
    description: "Find out how disappointed people would be if they could not use your service any more.",
    category: "In-Moment",
    icon: "",
  },
  {
    title: "Feature Chaser",
    description: "Show a survey about a new feature shown only to people who used it.",
    category: "In-Moment",
    icon: "",
  },
  {
    title: "Cancel Subscription Flow",
    description: "Request users going through a cancel subscription flow before cancelling.",
    category: "In-Moment",
    icon: "",
  },
  {
    title: "Interview Prompt",
    description: "Ask high-interest users to book a time in your calendar to get all the juicy details.",
    category: "Exploration",
    icon: "",
  },
  {
    title: "Fake Door Follow-Up",
    description: "Running a fake door experiment? Catch users right when they are full of expectations.",
    category: "Exploration",
    icon: "",
  },
  {
    title: "Feedback Box",
    description: "Give users the chance to share feedback in a single click.",
    category: "Retain Users",
    icon: "",
  },
  {
    title: "Bug Report Form",
    description: "Catch all bugs in your SaaS with easy and accessible bug reports.",
    category: "Retain Users",
    icon: "",
  },
  {
    title: "Rage Click Survey",
    description: "Sometimes things don’t work. Trigger this rage click survey to catch users in rage.",
    category: "Retain Users",
    icon: "",
  },
  {
    title: "Feature Request Widget",
    description: "Allow users to request features and pipe it to GitHub projects or Linear.",
    category: "Retain Users",
    icon: "",
  },
];

export default function InsightOppos() {
  return (
    <div className="pt-12 pb-10 md:pt-40">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8" id="best-practices">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          Insight{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            Opportunities
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl">
          All Best Practices for qualitative user research in one product.
        </p>
      </div>
      <div>
        <div className=" mx-auto grid max-w-5xl grid-cols-1 gap-6 px-2 sm:grid-cols-2">
          {BestPractices.map((bestPractice) => (
            <div
              key={bestPractice.title}
              className="drop-shadow-card duration-120 relative cursor-default rounded-lg bg-slate-100 p-8 transition-all ease-in-out hover:scale-105 dark:bg-slate-800">
              <div
                className={clsx(
                  // base styles independent what type of button it is
                  "absolute right-10 rounded-full py-1 px-3",
                  // different styles depending on size
                  bestPractice.category === "In-Moment" &&
                    "bg-pink-100 text-pink-500 dark:bg-pink-800 dark:text-pink-200",
                  bestPractice.category === "Exploration" &&
                    "bg-blue-100 text-blue-500 dark:bg-blue-800 dark:text-blue-200",
                  bestPractice.category === "Retain Users" &&
                    "bg-orange-100 text-orange-500 dark:bg-orange-800 dark:text-orange-200"
                )}>
                {bestPractice.category}
              </div>
              <div className="h-12 w-12">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <defs />
                  <path
                    d="M9,7.5H7.059A6.059,6.059,0,0,0,1,13.558v4.988c0,1.5.662,2.218,1.97,2.937a.059.059,0,0,1,.03.051V23.5H9Z"
                    fill="#c4f0eb"
                  />
                  <path
                    d="M8,7.5H7.059A6.059,6.059,0,0,0,1,13.558v4.988c0,1.5.662,2.218,1.97,2.937a.059.059,0,0,1,.03.051V23.5"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M8,18.824V22.5a1,1,0,0,0,1,1H22a1,1,0,0,0,1-1V1.5a1,1,0,0,0-1-1H17.95a.5.5,0,0,0-.49.4,2,2,0,0,1-3.92,0,.5.5,0,0,0-.49-.4H9a1,1,0,0,0-1,1V18.824Z"
                    fill="#00e6ca"
                  />
                  <path
                    d="M15.5,2.5A2,2,0,0,1,13.54.9a.5.5,0,0,0-.49-.4H9a1,1,0,0,0-1,1v21a1,1,0,0,0,1,1h6.5Z"
                    fill="#c4f0eb"
                  />
                  <path
                    d="M13.782,15.4l3.259,1.214,2-1.364a1.109,1.109,0,0,1,.876-.168,1.189,1.189,0,0,1,.852.766,1.106,1.106,0,0,1,.066.378,1.175,1.175,0,0,1-.548,1.018l-6.762,4.2a.415.415,0,0,1-.458-.013l-2.479-1.74a.229.229,0,0,1-.035-.322.234.234,0,0,1,.039-.038l1.04-.918a.231.231,0,0,1,.222-.038l1.3.777,1.653-1.154L12.4,16.5"
                    fill="#f8fafc"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8,18.824V22.5a1,1,0,0,0,1,1H22a1,1,0,0,0,1-1V1.5a1,1,0,0,0-1-1H17.95a.5.5,0,0,0-.49.4,2,2,0,0,1-3.92,0,.5.5,0,0,0-.49-.4H9a1,1,0,0,0-1,1v11"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M10.25,7a.25.25,0,1,1-.25.25A.25.25,0,0,1,10.25,7"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M12.75,7a.25.25,0,1,1-.25.25A.25.25,0,0,1,12.75,7"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M15.25,7a.25.25,0,1,1-.25.25A.25.25,0,0,1,15.25,7"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M17.75,7a.25.25,0,1,1-.25.25A.25.25,0,0,1,17.75,7"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M20.25,7a.25.25,0,1,1-.25.25A.25.25,0,0,1,20.25,7"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M7,19.467A3.2,3.2,0,0,0,9,16.5h2.847a2.108,2.108,0,0,0,2.133-1.709A2,2,0,0,0,12,12.5H6.5"
                    stroke="#0f172a"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#c4f0eb"
                  />
                </svg>
              </div>
              <h3 className="mt-3 mb-1 text-xl font-bold text-slate-700 dark:text-slate-200">
                {bestPractice.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{bestPractice.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
