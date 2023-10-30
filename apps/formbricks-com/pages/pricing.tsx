import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import { OpenSourceInfo } from "@/components/shared/OpenSourceInfo";
import { GetStartedWithPricing } from "@/components/shared/PricingGetStarted";
import { PricingTable } from "../components/shared/PricingTable";

const inProductSurveys = {
  leadRow: {
    title: "Website and In-App Surveys",
    comparison: "like HotJar",
    free: (
      <div>
        <span>250 Submissions</span> <span className="text-slate-400">/ Month</span>{" "}
      </div>
    ),
    paid: "Unlimited",
  },
  features: [
    { name: "Unlimited Surveys", free: true, paid: true },
    { name: "Unlimited Team Members", free: true, paid: true },
    { name: "API Access", free: true, paid: true },
    { name: "30+ Templates", free: true, paid: true },
    { name: "Unlimited Responses per Survey", free: false, paid: true },
    { name: "Team Role Management", free: false, paid: true, comingSoon: true },
    { name: "Advanced User Targeting", free: false, paid: true, comingSoon: true },
    { name: "Multi Language Surveys", free: false, paid: true, comingSoon: true },
  ],
  endRow: {
    title: "Website and In-App Surveys",
    free: "Free",
    paid: (
      <div>
        <span>Free</span>{" "}
        <span className="text-slate-400">
          up to 250 submissions / month <br />
          then{" "}
        </span>
        <span>$0.15</span>
        <span className="text-slate-400"> / submission</span>
      </div>
    ),
  },
};

const userSegmentation = {
  leadRow: {
    title: "User Segmentation",
    comparison: "like Segment",
    free: (
      <div>
        <span>2500 Users</span> <span className="text-slate-400">/ Month</span>{" "}
      </div>
    ),
    paid: "Unlimited",
  },
  features: [
    { name: "Identify Users", free: true, paid: true },
    { name: "Collect Events", free: true, paid: true },
    { name: "Collect Attributes", free: true, paid: true },
    { name: "Advanced User Targeting", free: false, paid: true, comingSoon: true },
    { name: "Reusable Segments", free: false, paid: true, comingSoon: true },
  ],
  endRow: {
    title: "User Segmentation like Segment",
    free: "Free",
    paid: (
      <div>
        <span>Free</span>{" "}
        <span className="text-slate-400">
          up to 2500 users / month <br />
          then{" "}
        </span>
        <span>$0.01</span>
        <span className="text-slate-400"> / user</span>
      </div>
    ),
  },
};

const linkSurveys = {
  leadRow: {
    title: "Link Surveys",
    comparison: "like Typeform",
    free: <span>Unlimited</span>,
    paid: "Unlimited",
  },

  features: [
    { name: "Unlimited Surveys", free: true, paid: true },
    { name: "Unlimited Responses", free: true, paid: true },
    { name: "Partial Responses", free: true, paid: true },
    { name: "Multi-media Backgrounds", free: true, paid: true },
    { name: "File Upload", free: true, paid: true },
    { name: "Hidden Fields", free: true, paid: true },
    { name: "Single Use Survey Links", free: true, paid: true },
    { name: "Pin-protected Surveys", free: true, paid: true },
    { name: "Custom Styling", free: true, paid: true, comingSoon: true },
    { name: "Recall Information", free: true, paid: true, comingSoon: true },
    { name: "Collect Payments, Signatures and Appointments", free: true, paid: true, comingSoon: true },
    { name: "Custom URL", free: false, paid: true },
    { name: "Remove Formbricks Branding", free: false, paid: true },
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
        </div>
      </div>
    </Layout>
  );
};

export default PricingPage;
