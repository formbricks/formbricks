import SalesCTA from "@/components/salespage/SalesCTA";
import Image, { StaticImageData } from "next/image";

interface SalesPageFeatureProps {
  imgSrc: StaticImageData;
  imgAlt: string;
  headline: string;
  subheadline: string;
  imgLeft?: boolean;
}

export default function SalesPageFeature({
  imgSrc,
  imgAlt,
  headline,
  subheadline,
  imgLeft,
}: SalesPageFeatureProps) {
  return (
    <div className="grid grid-cols-2 content-center gap-12">
      <div className={`space-y-6 ${imgLeft && `order-last`}`}>
        <h2 className="text-balance text-3xl font-bold text-slate-800">{headline}</h2>
        <p className="text-pretty text-lg text-slate-700">{subheadline}</p>
        <SalesCTA />
      </div>
      <div className="relative">
        <Image src={imgSrc} alt={imgAlt} fill={true} objectFit="cover" className="rounded-md" />
      </div>
    </div>
  );
}
