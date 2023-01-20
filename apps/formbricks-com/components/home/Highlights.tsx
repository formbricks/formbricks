import Image from "next/image";
import ImageAnalytics from "@/images/connect-analytics.png";
import ImageInsights from "@/images/insights.png";
import ImageDarkAnalytics from "@/images/dark-connect-analytics.png";
import ImageDarkInsights from "@/images/dark-insights.png";

const userBase = [
  {
    email: "anna@open.com",
    status: "Signed Up",
  },
  {
    email: "tim@yama.com",
    status: "Activated",
  },
  {
    email: "beth@lehem.com",
    status: "Customer",
  },
  {
    email: "pied@piper.com",
    status: "Customer",
  },
  {
    email: "janice@late.com",
    status: "Churned",
  },
];

export default function Highlights({}) {
  return (
    <>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 md:pb-0">
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                Connect product analytics,
                <br />
                <span className="font-light">ask specific user cohorts.</span>
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-slate-500 dark:text-slate-400">
                Email is spammy and ineffective. Create cohorts based on usage data and reach out to specific
                cohorts in-app.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8">
              <Image src={ImageAnalytics} alt="react library" className="block rounded-lg dark:hidden" />
              <Image src={ImageDarkAnalytics} alt="react library" className="hidden rounded-lg dark:block" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8 md:order-first">
              <Image src={ImageInsights} alt="react library" className="block rounded-lg dark:hidden" />
              <Image src={ImageDarkInsights} alt="react library" className="hidden rounded-lg dark:block" />
            </div>
            <div className="pb-8 md:pb-0">
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Fill the gaps between
                <br />
                <span className="font-light">analytics and interviews.</span>
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-slate-500 dark:text-slate-400">
                Product analytics tell you WHAT users do, not WHY. Complement user interviews with a constant
                flow of qualitative user insights.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 md:pb-0">
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
                From sign up to paid plan:
                <br />
                <span className="font-light">Never ask something twice.</span>
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-slate-500 dark:text-slate-400">
                With Formbricks you build a database of everyone who signs up to your product. Enrich their
                profile at key moments in the user journey.
              </p>
            </div>
            <div className="w-full rounded-lg bg-slate-100 p-8 dark:bg-slate-800">
              {userBase.map((user) => (
                <div className="my-2 flex w-full justify-between rounded-lg bg-slate-50 py-2 px-4 text-slate-700 transition-all duration-75 ease-in-out hover:scale-105 dark:bg-slate-700 dark:text-slate-300">
                  {user.email}
                  <p className="xs:max-md:block hidden rounded-full bg-slate-200 px-3 text-sm dark:bg-slate-600 lg:block ">
                    {user.status}
                  </p>
                  <a href={"mailto:" + user.email} className="text-brand font-semibold">
                    Reach Out
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
