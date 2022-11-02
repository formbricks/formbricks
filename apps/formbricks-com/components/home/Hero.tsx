import Button from "../shared/Button";
import HeroAnimation from "./HeroAnimation";
import HeroTitle from "../shared/HeroTitle";
import { useRouter } from "next/router";

interface Props {}

export default function Hero({}: Props) {
  const router = useRouter();
  return (
    <div className="relative">
      <HeroTitle
        HeadingPt1="The"
        HeadingTeal="Open Source"
        HeadingPt2="Forms & Survey Toolbox"
        Subheading="We're building all essential form functionality so you don't have to. Modular, customizable,
        extendable. And open-source.">
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
