import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import WhyFormbricks from "../components/shared/WhyFormbricks";
import CTA from "@/components/shared/CTA";

const IndexPage = () => (
  <Layout
    title="Formbricks | Open Source Forms & Survey Toolbox"
    description="Modular, customizable and extendable form infrastructure. Build exactly the form or survey solution you need in a fraction of the time. 100% data ownership.">
    <Hero />
    <Features />
    <Highlights />
    <WhyFormbricks />
    <CTA />
  </Layout>
);

export default IndexPage;
