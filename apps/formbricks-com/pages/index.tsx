import Layout from "@/components/shared/Layout";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Highlights from "@/components/home/Highlights";
import FeatureTable from "@/components/home/FeatureTable";
import CTA from "@/components/home/CTA";

const IndexPage = () => (
  <Layout meta={{ title: "Home | Next.js + TypeScript Example" }}>
    <Hero />
    <Features />
    <Highlights />
    <FeatureTable />
    <CTA />
  </Layout>
);

export default IndexPage;
