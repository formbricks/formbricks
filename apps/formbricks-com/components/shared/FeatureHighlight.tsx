import Image from "next/image";
import ImageReactLib from "@/images/react-lib.png";
import ImageSchemaGeneration from "@/images/schema-generation-svg.svg";
import Button from "./Button";
import { useRouter } from "next/router";

interface Props {
  Heading1: string;
  Text1Pt1: string;
  Text1Pt2?: string;
  CTA1Text?: string;
  CTA1Href?: string;
  Image1: React.ReactNode;
  Heading2: string;
  Text2Pt1: string;
  Text2Pt2?: string;
  CTA2Text?: string;
  CTA2Href?: string;
  Image2: React.ReactNode;
  children?: React.ReactNode;
}

export default function FeatureHighlights({
  Heading1,
  Text1Pt1,
  Text1Pt2,
  CTA1Text,
  CTA1Href,
  Image1,
  Heading2,
  Text2Pt1,
  Text2Pt2,
  CTA2Text,
  CTA2Href,
  Image2,
  children,
}: Props) {
  const router = useRouter();

  return (
    <>
      <div className="mt-32">
        <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-3xl">
                {Heading1}
              </h2>
              <p className="mt-6 leading-7 text-blue-500 text-md dark:text-blue-300">{Text1Pt1}</p>
              <p className="mt-6 leading-7 text-blue-500 text-md dark:text-blue-300">{Text1Pt2}</p>
              <div className="mt-6">
                <Button variant="minimal" size="sm" onClick={() => router.push({})}>
                  {CTA1Text}
                </Button>
              </div>
            </div>
            <Image src={ImageReactLib} alt="react library" className="rounded-lg" />
          </div>
        </div>
      </div>
      <div className="mt-32">
        <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <Image src={ImageSchemaGeneration} alt="react library" className="rounded-lg" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-3xl">
                {Heading2}
              </h2>
              <p className="mt-6 leading-7 text-blue-500 text-md dark:text-blue-300">{Text2Pt1}</p>
              <p className="mt-6 leading-7 text-blue-500 text-md dark:text-blue-300">{Text2Pt2}</p>
              <div className="mt-6">
                <Button variant="minimal" size="sm" onClick={() => router.push("/core-api")}>
                  {CTA2Text}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
