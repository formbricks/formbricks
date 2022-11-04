import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import WhyFormbricks from "../components/shared/WhyFormbricks";
import CTA from "@/components/shared/CTA";

const IndexPage = () => (
  <Layout
    title="The Open Source Forms & Survey Toolbox"
    description="We're building all essential form functionality so you don't have to. Modular, customizable, extendable. And open source.">
    <Hero />
    <Features />
    <Highlights />
    <WhyFormbricks />
    <CTA />
  </Layout>
);

export default IndexPage;
