import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights"; /* 
import BreakerCTA from "@/components/shared/BreakerCTA"; */
import Steps from "@/components/home/Steps";

const IndexPage = () => (
  <Layout
    title="Formbricks | Natively embedded user research for B2B SaaS"
    description="Build qualitative user research into your product. Leverage Best practices to increase Product-Market Fit.">
    <Hero />
    <Highlights />
    {/*     <BreakerCTA
      teaser="Curious?"
      headline="Find out more"
      subheadline="Dive into the project on GitHub."
      cta="View on GitHub"
      href="https://www.formbricks.com/github"
    /> */}

    <Features />
    <Steps />
    {/*     <BreakerCTA
      teaser="Curious?"
      headline="Get access now"
      subheadline="We’re onboarding design partners regularly. Sign up to get early access."
      cta="Get access"
      href="/waitlist"
      inverted
    /> */}
  </Layout>
);

export default IndexPage;
