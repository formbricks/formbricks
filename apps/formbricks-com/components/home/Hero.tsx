import Button from "../shared/Button";
import HeroAnimation from "../shared/HeroAnimation";
import HeroTitle from "../shared/HeroTitle";
import { useRouter } from "next/router";

interface Props {}

export default function Hero({}: Props) {
  const router = useRouter();
  return (
    <div className="relative">
      <HeroTitle
        headingPt1="The"
        headingTeal="Open Source"
        headingPt2="Form & Survey Toolbox"
        subheading="Bring all qualitative user data on one open source platform. Modular, customizable,
        extendable.">
        <Button variant="secondary" onClick={() => router.push("/docs")}>
          Read docs
        </Button>
        <Button variant="primary" className="ml-3" onClick={() => router.push("/get-started")}>
          Get started
        </Button>
      </HeroTitle>
      <HeroAnimation />
    </div>
  );
}
