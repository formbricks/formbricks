import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import TryItCTA from "../components/shared/TryItCTA";
import HeroAnimation from "../components/shared/HeroAnimation";
import HeadingCentered from "@/components/shared/HeadingCenetered";

const FormHQPage = () => (
  <Layout meta={{ title: "FormHQ by Formbricks – Open-source Form Infrastructure" }}>
    <HeroTitle headingPt1="Form" headingTeal="HQ" />
    <HeroAnimation />
    <HeadingCentered
      teaser="You have arrived"
      heading="Everything you always wanted (from a form tool)"
      subheading="The days of scattered response data are counted. Manage all form data in one place. Analyze right here or pipe your data where you need it."
    />
    <TryItCTA />
  </Layout>
);

export default FormHQPage;
