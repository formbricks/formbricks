import { EnterpriseEditionInfo } from "@/components/shared/EnterpriseEditionInfo";
import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import { OpenSourceInfo } from "@/components/shared/OpenSourceInfo";
import { GetStartedWithPricing } from "@/components/shared/PricingGetStarted";

import { PricingTable } from "../components/shared/PricingTable";

const inProductSurveys = {
  leadRow: {
    title: "Website and In-App Surveys",
    comparison: "like HotJar Ask",
    free: "Community Edition",
    paid: "Enterprise Edition",
  },
  features: [
    { name: "Unlimited surveys", free: true, paid: true },
    { name: "Unlimited team members", free: true, paid: true },
    { name: "API access", free: true, paid: true },
    { name: "35+ templates", free: true, paid: true },
    { name: "Unlimited responses", free: "250 responses / month", paid: "Unlimited" },
    { name: "Team role management", free: false, paid: true },
    { name: "Multi-language surveys", free: false, paid: true },
  ],
  endRow: {
    title: "Website and In-App Surveys",
    free: "Free",
    paid: "$0.15 / response",
  },
};

const userSegmentation = {
  leadRow: {
    title: "User Segmentation",
    comparison: "like Segment",
    free: "Community Edition",
    paid: "Enterprise Edition",
  },
  features: [
    { name: "Collect events", free: true, paid: true },
    { name: "Collect attributes", free: true, paid: true },
    { name: "Reusable segments", free: true, paid: true },
    { name: "Basic targeting", free: true, paid: true },
    { name: "Identify users", free: "2,500 users / month", paid: "Unlimited" },
    { name: "Advanced targeting", free: false, paid: true },
  ],
  endRow: {
    title: "User Segmentation",
    free: "Free",
    paid: "$0.01 / identified user",
  },
};

const linkSurveys = {
  leadRow: {
    title: "Link Surveys",
    comparison: "like Typeform",
    free: "Community Edition",
    paid: "Enterprise Edition",
  },

  features: [
    { name: "Unlimited surveys", free: true, paid: true },
    { name: "Unlimited responses", free: true, paid: true },
    { name: "Partial responses", free: true, paid: true },
    { name: "Multi-media backgrounds", free: true, paid: true },
    { name: "File upload", free: true, paid: true },
    { name: "Hidden fields", free: true, paid: true },
    { name: "Single-use links", free: true, paid: true },
    { name: "Pin-protected surveys", free: true, paid: true },
    { name: "Custom styling", free: true, paid: true },
    { name: "Recall information", free: true, paid: true },
    { name: "Book appointments", free: true, paid: true },
    { name: "Collect payments", free: true, paid: true, comingSoon: true },
    { name: "Collect signatures", free: true, paid: true, comingSoon: true },
    { name: "Custom URL", free: false, paid: true, comingSoon: true },
    { name: "Remove Formbricks branding", free: false, paid: true },
  ],

  endRow: {
    title: "Link Surveys Pricing",
    free: "Free",
    paid: "$30 / month",
  },
};

const integrations = {
  leadRow: {
    title: "Integrations",
    free: <span>Unlimited</span>,
    paid: "Unlimited",
  },
  features: [
    { name: "Webhooks", free: true, paid: true },
    { name: "Zapier", free: true, paid: true },
    { name: "Notion", free: true, paid: true },
    { name: "n8n", free: true, paid: true },
    { name: "Make", free: true, paid: true },
    { name: "Google Sheets", free: true, paid: true },
    { name: "Airtable", free: true, paid: true },
  ],
  endRow: {
    title: "Integrations Pricing",
    free: "Free",
    paid: "Free",
  },
};

const PricingPage = () => {
  return (
    <Layout
      title="Pricing | Formbricks Open Source Experience Management"
      description="All our plans start free - choose what's best for you!">
      {/* Formbricks Unlimited Deal */}
      {/* <div className="relative isolate mx-5 mt-8 overflow-hidden rounded-lg bg-slate-50 px-3 pt-4 shadow-2xl dark:bg-slate-800 sm:px-8 md:pt-8 lg:gap-x-10 lg:px-12 lg:pt-0">
        <svg
          viewBox="0 0 1024 1024"
          className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          aria-hidden="true">
          <circle
            cx={512}
            cy={512}
            r={512}
            fill="url(#759c1415-0410-454c-8f7c-9a820de03641)"
            fillOpacity="0.7"
          />
          <defs>
            <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
              <stop stopColor="#00E6CA" />
              <stop offset={0} stopColor="#00C4B8" />
            </radialGradient>
          </defs>
        </svg>
        <div className="mx-auto w-full text-center lg:mx-0 lg:flex-auto lg:py-8 lg:text-left">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-50 sm:text-3xl">
            Launch Special:
            <br /> Go Unlimited! Forever!
          </h2>
          <p className="text-md mt-6 leading-8 text-slate-700 dark:text-slate-50">
            Get access to all pro features and unlimited responses + identified users for a flat fee of{" "}
            <b>only $99/month.</b>
            <br /> <br />
            <span className="text-slate-400 dark:text-slate-300">
              This deal ends on 31st of October 2023 at 11:59 PM PST.
            </span>
          </p>
        </div>
        <div className="mb-8 mt-2 items-center justify-center">
          <Button className="w-full justify-center py-2 shadow-sm" href="https://app.formbricks.com/">
            Get Started
          </Button>
        </div>
      </div> */}

      <HeroTitle
        headingPt1=""
        headingTeal="Pricing"
        subheading="All our plans start free - choose what's best for you!"
      />
      <div className="space-y-24">
        <div>
          <GetStartedWithPricing showDetailed={true} />

          <PricingTable
            leadRow={linkSurveys.leadRow}
            pricing={linkSurveys.features}
            endRow={linkSurveys.endRow}
          />
        </div>

        <PricingTable
          leadRow={inProductSurveys.leadRow}
          pricing={inProductSurveys.features}
          endRow={inProductSurveys.endRow}
        />

        <PricingTable
          leadRow={userSegmentation.leadRow}
          pricing={userSegmentation.features}
          endRow={userSegmentation.endRow}
        />

        <PricingTable
          leadRow={integrations.leadRow}
          pricing={integrations.features}
          endRow={integrations.endRow}
        />

        <div>
          {/* <PricingCalculator /> */}
          <OpenSourceInfo />
          <EnterpriseEditionInfo />
        </div>
      </div>
    </Layout>
  );
};

export default PricingPage;
