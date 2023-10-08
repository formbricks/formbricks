import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";
import BreakerCTA from "@/components/shared/BreakerCTA";
import Layout from "@/components/shared/Layout";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import DashboardMockupDark from "@/images/dashboard-mockup-dark.png";
import DashboardMockup from "@/images/dashboard-mockup.png";
import PipelinesDark from "@/images/pipelines-dark.png";
import Pipelines from "@/images/pipelines.png";
import PreSegmentationDark from "@/images/pre-segmentation-dark.png";
import PreSegmentation from "@/images/pre-segmentation.png";
import Image from "next/image";

export default function MeasurePMFPage() {
  return (
    <Layout
      title="Product-Market Fit Survey with Formbricks"
      description="Measure Product-Market Fit to understand how to develop your product further.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Product-Market Fit" difficulty="Intermediate" setupMinutes="30" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            The Product-Market Fit survey is a proven method to get a continuous understanding of how users
            value your product. This helps you prioritize features to increase your PMF. To run it properly,
            you need granular control over who to ask when. Formbricks makes this possible.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            In a nutshell: Decide what constitutes a &quot;Power User&quot; in your product. Set and send the
            corresponding attribute to Formbricks and use it to pre-segment your user base. Formbricks
            automatically asks a predetermined amount of users weekly, bi-weekly or monthly. The continuous
            stream of insights help you develop your product with the core user needs front and center.
          </p>
          <UseCaseCTA href="/docs/best-practices/pmf-survey" />
        </div>
        <DemoPreview template="Product Market Fit (Superhuman)" />
      </div>
      {/* Steps */}
      <div id="howitworks" className="mx-auto mt-8 max-w-lg md:mt-32 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 sm:pl-10 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 1</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                1. Pre-Segmentation
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Signed up for more than 4 weeks? Used a specific feature? Set up a custom condition to{" "}
                <strong>only survey the right subset</strong> of your user base.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8">
              <Image
                src={PreSegmentation}
                quality="100"
                alt="Pre Segmentation"
                className="block dark:hidden"
              />

              <Image
                src={PreSegmentationDark}
                quality="100"
                alt="Pre Segmentation"
                className="hidden dark:block"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-12 mt-8 max-w-lg md:mb-0 md:mt-32 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last rounded-lg sm:py-8 md:order-first md:p-4">
              <DemoPreview template="Product Market Fit Survey (short)" />
            </div>
            <div className="pb-8 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 2</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Survey users in-app
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                On average, in-app surveys convert 6x better than email surveys. Get significant results even
                from smaller user bases.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mb-12 mt-8 max-w-lg md:mb-0 md:mt-32  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 sm:pl-10 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 3</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
                Loop in your team
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Pipe insights to where your team works: Slack, Discord, Email. Use the webhook and Zapier to
                pipe survey data where you want it.
              </p>
            </div>
            <div className="w-full rounded-lg bg-slate-100 p-8 dark:bg-slate-800">
              <Image
                src={Pipelines}
                quality="100"
                alt="Data Pipelines"
                className="block rounded-lg dark:hidden"
              />
              <Image src={PipelinesDark} quality="100" alt="Data Pipelines" className="hidden dark:block" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mb-12 mt-8 max-w-lg  md:mt-32  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last sm:scale-125 sm:p-8 md:order-first">
              <Image
                src={DashboardMockup}
                quality="100"
                alt="PMF Dashboard Mockup"
                className="block dark:hidden"
              />
              <Image
                src={DashboardMockupDark}
                quality="100"
                alt="PMF Dashboard Mockup"
                className="hidden dark:block"
              />
            </div>
            <div className="pb-8 pl-4 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 4</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Make better decisions
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Down the line we will allow you to build a custom dashboard specifically to gauge
                Product-Market Fit. Beat confirmation bias and
                <strong> build conviction for the next product decision.</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
      <BreakerCTA
        teaser="READY to measure PMF?"
        headline="Get started in minutes."
        subheadline="Measure Product-Market Fit with a survey that converts 6x better than email."
        cta="Sign up for free"
        href="https://app.formbricks.com/auth/signup"
      />
      <h2 className="mb-6 ml-4 mt-32 text-2xl font-semibold text-slate-700 dark:text-slate-300">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
