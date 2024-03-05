import SalesCTA from "@/components/salespage/SalesCTA";
import Image, { StaticImageData } from "next/image";

interface SalesPageHeroProps {
  imgSrc: StaticImageData;
  imgAlt: string;
  headline: string;
  subheadline: string;
}

export const SalesPageHero: React.FC<SalesPageHeroProps> = ({ imgSrc, imgAlt, headline, subheadline }) => {
  return (
    <div className="grid min-h-[60vh] grid-cols-2 content-center gap-12">
      <div className="space-y-6">
        <h1 className="text-5xl font-bold text-slate-800">{headline}</h1>
        <p className="text-pretty text-lg text-slate-700">{subheadline}</p>
        <SalesCTA />
      </div>
      <div className="relative">
        <Image src={imgSrc} alt={imgAlt} fill={true} objectFit="cover" className="rounded-md" />
      </div>
    </div>
  );
};
