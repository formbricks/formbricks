import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { isSafeMediaUrl } from "@formbricks/survey-ui";
import { ExpandIcon } from "@/components/icons/expand-icon";
import { ImageDownIcon } from "@/components/icons/image-down-icon";
import { cn } from "@/lib/utils";
import { checkForLoomUrl, checkForVimeoUrl, checkForYoutubeUrl, convertToEmbedUrl } from "@/lib/video-upload";

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
  className?: string;
}

export function ElementMedia({ imgUrl, videoUrl, altText = "Image", className }: ElementMediaProps) {
  const { t } = useTranslation();
  // Every sink is validated, not just the href. `ZStorageUrl` now rejects unsafe schemes on write, but
  // this component renders survey JSON straight from the API, and rows written before that validation
  // can still carry a `javascript:`/`data:` URL. An unsafe value in `<iframe src>` executes; in
  // `<img src>` it does not, but neither should reach the DOM from stored data.
  const safeVideoUrl = asSafeMediaUrl(videoUrl ? getVideoUrlWithParams(videoUrl) : undefined);
  const safeImgUrl = asSafeMediaUrl(imgUrl);
  const safeHref = asSafeMediaUrl(imgUrl ?? convertToEmbedUrl(videoUrl ?? ""));
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={cn("group/image relative mb-6 block min-h-40 rounded-md", className)}>
      {isLoading ? (
        <div className="absolute inset-auto flex h-full w-full animate-pulse items-center justify-center rounded-md bg-slate-200" />
      ) : null}
      {safeImgUrl ? (
        <img
          key={safeImgUrl}
          src={safeImgUrl}
          alt={altText}
          className={cn("rounded-custom mx-auto max-h-[40dvh] object-contain", isLoading ? "opacity-0" : "")}
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
          <div className="rounded-custom bg-black">
            <iframe
              src={safeVideoUrl}
              title={t("common.question_video")}
              frameBorder="0"
              className={cn("rounded-custom aspect-video w-full", isLoading ? "opacity-0" : "")}
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
        aria-label={t("common.open_in_new_tab")}
        className={cn(
          "absolute right-2 bottom-2 flex items-center gap-2 rounded-md bg-slate-800/40 p-1.5",
          "text-white backdrop-blur-lg transition duration-300 ease-in-out",
          "opacity-0 group-hover/image:opacity-100 hover:bg-slate-800/65 focus:opacity-100"
        )}>
        {imgUrl ? <ImageDownIcon size={20} /> : <ExpandIcon size={20} />}
      </a>
    </div>
  );
}
