import Faq from "@/components/home/Faq";
import Features from "@/components/home/Features";
import GitHubSponsorship from "@/components/home/GitHubSponsorship";
import Hero from "@/components/home/Hero";
import Highlights from "@/components/home/Highlights";
import Steps from "@/components/home/Steps";
import BestPractices from "@/components/shared/BestPractices";
import BreakerCTA from "@/components/shared/BreakerCTA";
import Layout from "@/components/shared/Layout";

const IndexPage = () => (
  <Layout
    title="Formbricks | Privacy-first Experience Management"
    description="Build qualitative user research into your product. Leverage Best practices to increase Product-Market Fit.">
    <Hero />
    <div className="hidden lg:block">
      <GitHubSponsorship />
    </div>
    <BestPractices />
    <Features />
    <Highlights />
    <div className="block lg:hidden">
      <GitHubSponsorship />
    </div>
    <div className="hidden lg:block">
      <BreakerCTA
        teaser="READY?"
        headline="Create surveys in minutes."
        subheadline="Don’t take our word for it, try it yourself."
        cta="Create survey"
        href="https://app.formbricks.com/auth/signup"
      />
    </div>
    <div className="pb-16">&nbsp;</div>
    <Steps />

    <BreakerCTA
      teaser="Curious?"
      headline="Give it a squeeze 🍋"
      subheadline="All 'Pro' features are free on Formbricks. Give it a go!"
      cta="Start for free"
      href="https://app.formbricks.com/auth/signup"
      inverted
    />

    <Faq />
  </Layout>
);

export default IndexPage;
