import { Download, ExternalLink } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  checkForLoomUrl,
  checkForVimeoUrl,
  checkForYoutubeUrl,
  convertToEmbedUrl,
  isSafeMediaUrl,
} from "@/lib/video";

//Function to add extra params to videoUrls in order to reduce video controls
const getVideoUrlWithParams = (videoUrl: string): string | undefined => {
  // Only the three supported platforms may reach the iframe, and only as the normalized embed URL that
  // convertToEmbedUrl builds from a hardcoded origin plus an extracted id. Returning `videoUrl`
  // unchanged for anything else put an arbitrary attacker-chosen URL into `<iframe src>` — a
  // `javascript:`/`data:` payload, or a phishing page framed inside a survey on the customer's site.
  const embedUrl = convertToEmbedUrl(videoUrl);
  if (!embedUrl) return undefined;

  if (checkForYoutubeUrl(videoUrl)) return embedUrl.concat("?controls=0");
  if (checkForVimeoUrl(videoUrl))
    return embedUrl.concat(
      "?title=false&transcript=false&speed=false&quality_selector=false&progress_bar=false&pip=false&fullscreen=false&cc=false&chromecast=false"
    );
  if (checkForLoomUrl(videoUrl))
    return embedUrl.concat("?hide_share=true&hideEmbedTopBar=true&hide_title=true");
  return undefined;
};

/** Validated media URL, or `undefined` when it must not reach a `src`/`href`. */
const asSafeMediaUrl = (url: string | undefined): string | undefined =>
  url && isSafeMediaUrl(url) ? url : undefined;

interface ElementMediaProps {
  imgUrl?: string;
  videoUrl?: string;
  altText?: string;
}

function ElementMedia({ imgUrl, videoUrl, altText = "Image" }: Readonly<ElementMediaProps>): React.ReactNode {
  // Every sink is validated, not just the href. `ZStorageUrl` now rejects unsafe schemes on write, but
  // this component renders survey JSON straight from the API, and rows written before that validation
  // can still carry a `javascript:`/`data:` URL. An unsafe value in `<iframe src>` executes; in
  // `<img src>` it does not, but neither should reach the DOM from stored data.
  const safeVideoUrl = asSafeMediaUrl(videoUrl ? getVideoUrlWithParams(videoUrl) : undefined);
  const safeImgUrl = asSafeMediaUrl(imgUrl);
  const safeHref = asSafeMediaUrl(imgUrl ?? convertToEmbedUrl(videoUrl ?? ""));
  const [isLoading, setIsLoading] = React.useState(true);

  if (!safeImgUrl && !safeVideoUrl) {
    return null;
  }

  return (
    <div className="group/image relative mb-6 block min-h-40 rounded-md">
      {isLoading ? (
        <div className="absolute inset-auto flex h-full w-full animate-pulse items-center justify-center rounded-md bg-slate-200" />
      ) : null}
      {safeImgUrl ? (
        <img
          key={safeImgUrl}
          src={safeImgUrl}
          alt={altText}
          className={cn("mx-auto max-h-[40dvh] rounded-md object-contain", isLoading ? "opacity-0" : "")}
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={() => {
            setIsLoading(false);
          }}
        />
      ) : null}
      {safeVideoUrl ? (
        <div className="relative">
          <div className="rounded-md bg-black">
            <iframe
              src={safeVideoUrl}
              title="Question video"
              className={cn("aspect-video w-full rounded-md border-0", isLoading ? "opacity-0" : "")}
              onLoad={() => {
                setIsLoading(false);
              }}
              onError={() => {
                setIsLoading(false);
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : null}
      <a
        href={safeHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in new tab"
        className="bg-opacity-40 hover:bg-opacity-65 absolute right-2 bottom-2 flex items-center gap-2 rounded-md bg-slate-800 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out group-hover/image:opacity-100">
        {imgUrl ? <Download size={20} /> : <ExternalLink size={20} />}
      </a>
    </div>
  );
}

export { ElementMedia };
export type { ElementMediaProps };
