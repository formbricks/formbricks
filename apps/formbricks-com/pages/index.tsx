import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import InsightOppos from "@/components/shared/InsightOppos";
import JoinWaitlist from "@/components/shared/JoinWaitlist";

const IndexPage = () => (
  <Layout
    title="Formbricks | Natively embedded user research for B2B SaaS"
    description="Build qualitative user research into your product. Leverage Best practices to increase Product-Market Fit.">
    <Hero />
    <Features />
    <JoinWaitlist />
    <Highlights />
    <InsightOppos />
    <JoinWaitlist inverted />
  </Layout>
);

export default IndexPage;
