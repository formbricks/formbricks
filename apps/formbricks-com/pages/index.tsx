import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import BreakerCTA from "@/components/shared/BreakerCTA";
import Steps from "@/components/home/Steps";
import Pricing from "@/components/shared/Pricing";

const IndexPage = () => (
  <Layout
    title="Formbricks | Natively embedded user research for B2B SaaS"
    description="Build qualitative user research into your product. Leverage Best practices to increase Product-Market Fit.">
    <Hero />
    <Highlights />
    <BreakerCTA
      teaser="READY?"
      headline="It's free to get started."
      subheadline="Don’t take our word for it, try it yourself."
      cta="Start for free"
      href="https://app.formbricks.com/auth/signup"
    />
    <Features />
    <Steps />
    <BreakerCTA
      teaser="Curious?"
      headline="Give it a squeeze 🍋"
      subheadline="Formbricks is free to get started. Give it a go!"
      cta="Get started"
      href="https://app.formbricks.com/auth/signup"
      inverted
    />
    <Pricing />
  </Layout>
);

export default IndexPage;
