import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import ImageWebhooks from "@/images/webhook-png.png";
import Image from "next/image";
import CTA from "../components/shared/CTA";
import FeatureHighlight from "@/components/shared/FeatureHighlight";

const WebhooksPage = () => (
  <Layout
    title="Webhooks"
    description="Don't be limited by our choice of integrations, pipe your data exactly where you need it.">
    <HeroTitle headingPt1="Webhooks" />
    <FeatureHighlight
      featureTitle="Versatile data handling"
      text="Don't be limited by our choice of integrations, pipe your data exactly where you need it. Set up webhooks in our Formbricks HQ with just a few clicks.
      Don't miss any piece of information by sending partial submissions alongside complete ones."
      img={<Image src={ImageWebhooks} alt="react library" className="rounded-lg" />}
      isImgLeft
      cta="Read docs"
      href="/docs"
    />
    <CTA />
  </Layout>
);

export default WebhooksPage;
