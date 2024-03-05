import LayoutLight from "@/components/salespage/LayoutLight";
import { SalesPageHero } from "@/components/salespage/SalesPageHero";
import PlaceholderImg from "@/images/placeholder.png";

export default function LinkSurveyPage() {
  return (
    <LayoutLight
      title="The Open Source Typeform Alternative"
      description="Run surveys like with Google Forms, Microsoft Forms, Typeform or Jotform with our open source form builder.">
      <SalesPageHero
        headline="The Open Source Typeform Alternative"
        subheadline="Create beautiful online forms for free – all open-source. Unlimited surveys, unlimited responses. Easily self-hostable."
        imgSrc={PlaceholderImg}
        imgAlt="Free and open source Typeform alternative. Build forms online for free while keeping all data secure. Self-hosting for online form builder available for free."
      />
    </LayoutLight>
  );
}
