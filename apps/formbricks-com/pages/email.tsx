import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import ImageEmail from "@/images/email.svg";
import Image from "next/image";
import TryItCTA from "../components/shared/TryItCTA";
import FeatureHighlight from "@/components/shared/FeatureHighlight";

const EmailPage = () => (
  <Layout meta={{ title: "Form to Email by Formbricks – Open-source Form Infrastructure" }}>
    <HeroTitle headingPt1="Email" />
    <FeatureHighlight
      featureTitle="Get responses to your inbox"
      text="In some cases, the good old email is the way to go. In the Form HQ you can setup forwarding submission data to one or more emails. "
      img={<Image src={ImageEmail} alt="react library" className="rounded-lg" />}
      isImgLeft
      cta="Get started"
      href="/get-started"
    />
    <TryItCTA />
  </Layout>
);

export default EmailPage;
