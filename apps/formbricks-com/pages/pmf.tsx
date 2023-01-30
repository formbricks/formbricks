import Layout from "@/components/shared/Layout";
import Button from "@/components/shared/Button";
import { useRouter } from "next/router";
import BreakerCTA from "@/components/shared/BreakerCTA";
import Features from "@/components/home/Features";
import Pricing from "@/components/shared/PmfPricing";
import Image from "next/image";
import DashboardMockup from "@/images/dashboard-mockup.png";
import Pipelines from "@/images/pipelines.png";
import PreSegmentation from "@/images/pre-segmentation.png";
import PmfDummy from "@/components/shared/PmfDummy";

export default function GetStartedPage() {
  const router = useRouter();
  return (
    <Layout
      title="Continuous Product-Market Fit Score"
      description="Measure the Product-Market Fit continuously. Use the Superhuman Product-Market-Fit to your advantage.">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Measure</span>{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            Product-Market Fit
          </span>{" "}
          <span className="inline ">continuously</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:text-xl">
          Gather actionable user insights with highly specific in-app surveys.
          <br />
          <span className="hidden md:block">
            Always know how your users perceive your product. Find PMF faster.
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
          <Button
            variant="secondary"
            onClick={() => router.push("https://demo.formbricks.com")}
            target="_blank">
            Try it out
          </Button>
          <Button
            variant="highlight"
            className="ml-3"
            onClick={() => router.push("https://app.formbricks.com")}
            target="_blank">
            Sign Up
          </Button>
        </div>
      </div>
      {/* Video */}

      <BreakerCTA
        teaser="Get started"
        headline="Measure your Product-Market Fit."
        subheadline="Feel the pulse of your user base. Get actionable insights."
        cta="Sign up"
        href="https://app.formbricks.com"
        inverted
      />

      {/* Steps */}
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 1</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                1. Pre-Segmentation
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Signed up for more than 4 weeks? Used a specific feature? Set up a custom condition to{" "}
                <strong>only survey the right subset</strong> of your users.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8">
              <Image src={PreSegmentation} alt="react library" className="block dark:hidden" />
              {/* 
              <Image src={ImageDarkAnalytics} alt="react library" className="hidden rounded-lg dark:block" /> */}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8 md:order-first">
              {/*  <Image src={Pipelines} alt="react library" className="block rounded-lg dark:hidden" />
              <Image src={ImageDarkInsights} alt="react library" className="hidden rounded-lg dark:block" /> */}
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
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 md:pb-0">
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
              <Image src={Pipelines} alt="react library" className="block rounded-lg dark:hidden" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 mb-12 max-w-lg md:mt-32 md:mb-0  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last scale-125 sm:p-8 md:order-first">
              <Image src={DashboardMockup} alt="react library" className="block dark:hidden" />{" "}
              {/*
              <Image src={ImageDarkInsights} alt="react library" className="hidden rounded-lg dark:block" /> */}
            </div>
            <div className="pb-8 pl-4 md:pb-0">
              <h4 className="text-brand-dark font-bold">Step 4</h4>
              <h2 className="xs:text-3xl text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Make better decisions
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                A dashboard specifically built to gauge Product-Market Fit survey. Beat confirmation bias and
                <strong> build conviction for the next product decision.</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Features />
      <BreakerCTA
        teaser="Get started"
        headline="Measure your Product-Market Fit."
        subheadline="Feel the pulse of your user base. Get actionable insights."
        cta="Sign up"
        href="https://app.formbricks.com"
      />
      <Pricing />
    </Layout>
  );
}
