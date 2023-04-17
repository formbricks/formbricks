import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import BreakerCTA from "@/components/shared/BreakerCTA";
import Steps from "@/components/home/Steps";
import Pricing from "@/components/shared/Pricing";
import GitHubSponsorship from "@/components/home/GitHubSponsorship";
import BestPractices from "@/components/shared/BestPractices";

const IndexPage = () => (
  <Layout
    title="Formbricks | Embedded User Research"
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
        headline="It's free to get started."
        subheadline="Don’t take our word for it, try it yourself."
        cta="Create surveys"
        href="https://app.formbricks.com/auth/signup"
      />
    </div>
    <div className="pb-16">&nbsp;</div>
    <Steps />

    <BreakerCTA
      teaser="Curious?"
      headline="Give it a squeeze 🍋"
      subheadline="Formbricks is free to get started. Give it a go!"
      cta="Start for free"
      href="https://app.formbricks.com/auth/signup"
      inverted
    />
    <Pricing />
  </Layout>
);

export default IndexPage;
