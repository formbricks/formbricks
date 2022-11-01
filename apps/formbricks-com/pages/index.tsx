import Link from "next/link";
import { Layout } from "@/components/shared/Layout";
import { Hero } from "@/components/home/Hero";

const IndexPage = () => (
  <Layout meta={{ title: "Home | Next.js + TypeScript Example" }}>
    <Hero />
  </Layout>
);

export default IndexPage;
