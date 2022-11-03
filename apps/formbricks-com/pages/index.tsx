import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import WhyFormbricks from "../components/shared/WhyFormbricks";
import CTA from "@/components/shared/CTA";

const IndexPage = () => (
  <Layout meta={{ title: "The Open-source Forms & Survey Toolbox" }}>
    <Hero />
    <Features />
    <Highlights />
    <WhyFormbricks />
    <CTA />
  </Layout>
);

export default IndexPage;
