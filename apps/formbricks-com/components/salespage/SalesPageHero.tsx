import SalesCTA from "@/components/salespage/SalesCTA";
import Image, { StaticImageData } from "next/image";

interface SalesPageHeroProps {
  imgSrc: StaticImageData;
  imgAlt: string;
  headline: React.ReactNode;
  subheadline: string;
}

export default function SalesPageHero({ imgSrc, imgAlt, headline, subheadline }: SalesPageHeroProps) {
  return (
    <div className="group grid content-center gap-12 pt-20 lg:grid-cols-2">
      <div className="my-auto space-y-6">
        <h1 className="text-5xl font-bold text-slate-800">{headline}</h1>
        <p className="text-balance text-lg text-slate-700">{subheadline}</p>
        <SalesCTA />
      </div>
      <div className="relative hidden lg:block">
        <Image
          src={imgSrc}
          alt={imgAlt}
          className="scale-110 rounded-3xl border border-slate-200 bg-white transition-all delay-75 duration-[1500ms] group-hover:scale-[115%] group-hover:border-slate-300"
        />
      </div>
    </div>
  );
}
