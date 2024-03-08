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
    <div className="group grid content-center gap-12 lg:grid-cols-2">
      <div
        className={`order-last flex flex-col justify-center space-y-6 lg:order-none ${imgLeft && `!order-last`}`}>
        <h2 className="text-balance text-3xl font-bold  text-slate-800">{headline}</h2>
        <p className="text-pretty text-lg text-slate-700">{subheadline}</p>
        <SalesCTA />
      </div>
      <div className="relative">
        <Image
          src={imgSrc}
          alt={imgAlt}
          className="rounded-3xl border border-slate-200 bg-white transition delay-75 duration-[1500ms] group-hover:scale-[105%] group-hover:border-slate-300"
        />
      </div>
    </div>
  );
}
