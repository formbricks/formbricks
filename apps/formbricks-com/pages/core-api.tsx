import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import ImageCoreApi from "@/images/core-api.svg";
import Image from "next/image";
import TryItCTA from "../components/shared/TryItCTA";
import WhyFormbricks from "../components/shared/WhyFormbricks";
import FeatureHighlight from "@/components/shared/FeatureHighlight";

const CoreAPIPage = () => (
  <Layout meta={{ title: "Core API by Formbricks – Open-source Form Infrastructure" }}>
    <HeroTitle headingPt1="Core" headingTeal="API" />
    <FeatureHighlight
      featureTitle="The OS form engine"
      text="Our core API handles all of the submission handling of your forms and surveys. Our main objective is versatility, so that you can use it with any currently existing form.
      Soon we will integrate it with our React Form Builder. This allows for handling schemas so that you get a full image of your submission data. "
      img={<Image src={ImageCoreApi} alt="react library" className="rounded-lg" />}
      isImgLeft
    />
    <WhyFormbricks />
    <TryItCTA />
  </Layout>
);

export default CoreAPIPage;
