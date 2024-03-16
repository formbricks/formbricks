import Image, { StaticImageData } from "next/image";

interface TestimonialProps {
  quote: string;
  author: string;
  imgSrc: StaticImageData;
  imgAlt: string;
  textSize: "base" | "large";
}

export default function SalesTestimonial({
  quote,
  author,
  imgAlt,
  imgSrc,
  textSize = "base",
}: TestimonialProps) {
  return (
    <div className="flex flex-col items-center space-y-4 rounded-xl border border-slate-200 bg-slate-100 p-8 text-center">
      <h3
        className={`text-balance font-medium text-slate-700 ${textSize === "base" ? "text-xl" : "text-xl lg:text-2xl"} `}>
        {quote}
      </h3>
      <p className="text-lg text-slate-500">{author}</p>
      <Image src={imgSrc} alt={imgAlt} width={100} height={100} className="rounded-full" />
    </div>
  );
}
