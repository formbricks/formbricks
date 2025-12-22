import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { ExpandIcon } from "@/components/icons/expand-icon";
import { ImageDownIcon } from "@/components/icons/image-down-icon";
import { cn } from "@/lib/utils";
import { checkForLoomUrl, checkForVimeoUrl, checkForYoutubeUrl, convertToEmbedUrl } from "@/lib/video-upload";

//Function to add extra params to videoUrls in order to reduce video controls
const getVideoUrlWithParams = (videoUrl: string): string => {
  const isYoutubeVideo = checkForYoutubeUrl(videoUrl);
  const isVimeoUrl = checkForVimeoUrl(videoUrl);
  const isLoomUrl = checkForLoomUrl(videoUrl);
  if (isYoutubeVideo) return videoUrl.concat("?controls=0");
  else if (isVimeoUrl)
    return videoUrl.concat(
      "?title=false&transcript=false&speed=false&quality_selector=false&progress_bar=false&pip=false&fullscreen=false&cc=false&chromecast=false"
    );
  else if (isLoomUrl) return videoUrl.concat("?hide_share=true&hideEmbedTopBar=true&hide_title=true");
  return videoUrl;
};

interface ElementMediaProps {
  imgUrl?: string;
  videoUrl?: string;
  altText?: string;
}

export function ElementMedia({ imgUrl, videoUrl, altText = "Image" }: ElementMediaProps) {
  const { t } = useTranslation();
  const videoUrlWithParams = videoUrl ? getVideoUrlWithParams(videoUrl) : undefined;
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="group/image relative mb-6 block min-h-40 rounded-md">
      {isLoading ? (
        <div className="absolute inset-auto flex h-full w-full animate-pulse items-center justify-center rounded-md bg-slate-200" />
      ) : null}
      {imgUrl ? (
        <img
          key={imgUrl}
          src={imgUrl}
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
      {videoUrlWithParams ? (
        <div className="relative">
          <div className="rounded-custom bg-black">
            <iframe
              src={videoUrlWithParams}
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
        href={imgUrl ? imgUrl : convertToEmbedUrl(videoUrl ?? "")}
        target="_blank"
        rel="noreferrer"
        aria-label={t("common.open_in_new_tab")}
        className="absolute right-2 bottom-2 flex items-center gap-2 rounded-md bg-slate-800/40 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out group-hover/image:opacity-100 hover:bg-slate-800/65">
        {imgUrl ? <ImageDownIcon size={20} /> : <ExpandIcon size={20} />}
      </a>
    </div>
  );
}
