import Image, { StaticImageData } from "next/image";
import { cn } from "@formbricks/lib/cn";

export interface PageHeaderProps {
  pageTitle: string | React.ReactNode;
  pageSubTitle?: string;
  pageBannerImage?: string | StaticImageData;
  hideBottomBorder?: boolean;
  // Horizontal
  cta?: React.ReactNode;
  // Vertical - At time of comment this is only used in DiscoverClient for the search section
  ctaVertical?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({
  cta,
  ctaVertical,
  pageTitle,
  pageSubTitle,
  pageBannerImage,
  hideBottomBorder = false,
  children,
}: PageHeaderProps) => {
  return (
    <div className={`relative overflow-visible ${!hideBottomBorder ? "border-b border-slate-200" : ""}`}>
      {pageBannerImage && (
        <div
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-[380px] select-none lg:block"
          style={{ zIndex: 0 }}>
          <Image
            src={pageBannerImage}
            alt="Page Banner Image"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 600px) 100vw, 280px"
          />
        </div>
      )}
      {/* {pageBannerImage && (
        // <img
        //   src={pageBannerImage}
        //   alt="Page Banner Image"
        //   className="pointer-events-none absolute right-0 top-0 h-full select-none"
        //   style={{ zIndex: 0, objectFit: "contain", height: "280px", width: "auto" }}
        // />
      )} */}
      {/* <div className="relative flex items-center justify-between space-x-4 pb-4"> */}
      <div className="relative z-10 flex items-center justify-between space-x-4 pb-4">
        <div className="flex flex-col space-y-1">
          {typeof pageTitle === "string" ? (
            <h1 className={cn("text-3xl font-bold capitalize text-slate-800")}>{pageTitle}</h1>
          ) : (
            pageTitle
          )}
          {pageSubTitle && <p className={cn("pb-4 pt-4 text-lg capitalize text-black")}>{pageSubTitle}</p>}
          {ctaVertical}
        </div>
        {cta}
      </div>
      {children}
    </div>
  );
};
